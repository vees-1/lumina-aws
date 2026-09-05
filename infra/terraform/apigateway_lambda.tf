resource "aws_iam_role" "lambda_exec" {
  name = "${var.app_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.app_name}-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.table.arn,
          "${aws_dynamodb_table.table.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.jobs.arn,
          aws_sqs_queue.dlq.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminAddUserToGroup"
        ]
        Resource = aws_cognito_user_pool.pool.arn
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/lambda/${var.app_name}-${var.environment}-api"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "worker_logs" {
  name              = "/aws/lambda/${var.app_name}-${var.environment}-worker"
  retention_in_days = 7
}

# --- Dummy Zip Package for Lambda Initialization ---

data "archive_file" "dummy_lambda" {
  type        = "zip"
  output_path = "${path.module}/dummy_lambda.zip"

  source {
    content  = "def handler(event, context):\n    return {'statusCode': 200, 'body': 'Lumina API'}\n"
    filename = "main.py"
  }
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.app_name}-${var.environment}-api"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "main.handler"
  runtime          = "python3.11"
  memory_size      = 1024
  timeout          = 60
  filename         = data.archive_file.dummy_lambda.output_path
  source_code_hash = data.archive_file.dummy_lambda.output_base64sha256

  environment {
    variables = {
      LUMINA_DYNAMODB_TABLE = aws_dynamodb_table.table.name
      LUMINA_S3_BUCKET      = aws_s3_bucket.uploads.id
      LUMINA_SQS_QUEUE_URL  = aws_sqs_queue.jobs.id
      LUMINA_AI_PROVIDER    = "demo"
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.pool.id
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.client.id
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "worker" {
  function_name    = "${var.app_name}-${var.environment}-worker"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "api.worker.lambda_handler"
  runtime          = "python3.11"
  memory_size      = 1024
  timeout          = 60
  filename         = data.archive_file.dummy_lambda.output_path
  source_code_hash = data.archive_file.dummy_lambda.output_base64sha256

  environment {
    variables = {
      LUMINA_DYNAMODB_TABLE = aws_dynamodb_table.table.name
      LUMINA_S3_BUCKET      = aws_s3_bucket.uploads.id
      LUMINA_AI_PROVIDER    = "demo"
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.pool.id
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.client.id
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_event_source_mapping" "sqs_worker" {
  event_source_arn        = aws_sqs_queue.jobs.arn
  function_name           = aws_lambda_function.worker.arn
  batch_size              = 5
  function_response_types = ["ReportBatchItemFailures"]
  scaling_config {
    maximum_concurrency = 2
  }
}

# --- API Gateway HTTP API Setup ---

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.app_name}-${var.environment}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.web_origins
    allow_methods = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 3600
  }

}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "root" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "ANY /"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Browser requests with an Authorization header are preflighted. These exact
# routes must take precedence over the authenticated ANY routes so OPTIONS can
# reach FastAPI's CORS middleware without requiring a JWT.
resource "aws_apigatewayv2_route" "options_proxy" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "OPTIONS /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "options_root" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "OPTIONS /"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "health" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /health"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
