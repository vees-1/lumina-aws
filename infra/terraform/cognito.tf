resource "aws_cognito_user_pool" "pool" {
  name = "${var.app_name}-${var.environment}-user-pool"

  auto_verified_attributes = ["email"]

  lambda_config {
    post_confirmation = aws_lambda_function.cognito_post_confirmation.arn
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }
}

resource "aws_cognito_user_pool_domain" "domain" {
  domain       = "lumina-app-${var.environment}-auth"
  user_pool_id = aws_cognito_user_pool.pool.id
}

resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.app_name}-${var.environment}-app-client"
  user_pool_id = aws_cognito_user_pool.pool.id

  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # SPA uses authorization code + PKCE; never place bearer tokens in a URL fragment.
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls = [
    "https://lumina-dd.online/en/sign-in",
    "https://lumina-dd.online/en",
    "https://lumina-dd.online",
    "https://www.lumina-dd.online/en/sign-in",
    "https://www.lumina-dd.online/en",
    "https://www.lumina-dd.online",
    "https://d124bi3e327i7a.cloudfront.net/en/sign-in",
    "https://d124bi3e327i7a.cloudfront.net/en",
    "https://d124bi3e327i7a.cloudfront.net",
    "http://localhost:3000/en/sign-in",
    "http://localhost:3000/en"
  ]
  logout_urls = [
    "https://lumina-dd.online/en/sign-in",
    "https://lumina-dd.online/en",
    "https://lumina-dd.online",
    "https://www.lumina-dd.online/en/sign-in",
    "https://www.lumina-dd.online/en",
    "https://www.lumina-dd.online",
    "https://d124bi3e327i7a.cloudfront.net/en/sign-in",
    "https://d124bi3e327i7a.cloudfront.net/en",
    "https://d124bi3e327i7a.cloudfront.net",
    "http://localhost:3000/en/sign-in",
    "http://localhost:3000/en"
  ]
  supported_identity_providers = ["COGNITO"]
}

resource "aws_cognito_user_group" "doctor" {
  name         = "doctor"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Clinician and Doctor Users"
}

resource "aws_cognito_user_group" "patient" {
  name         = "patient"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Patient Users"
}

data "archive_file" "cognito_post_confirmation" {
  type        = "zip"
  source_file = "${path.module}/lambda/cognito_post_confirmation.py"
  output_path = "${path.module}/cognito_post_confirmation.zip"
}

resource "aws_lambda_function" "cognito_post_confirmation" {
  function_name    = "${var.app_name}-${var.environment}-cognito-post-confirmation"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "cognito_post_confirmation.handler"
  runtime          = "python3.11"
  memory_size      = 128
  timeout          = 10
  filename         = data.archive_file.cognito_post_confirmation.output_path
  source_code_hash = data.archive_file.cognito_post_confirmation.output_base64sha256
}

resource "aws_cloudwatch_log_group" "cognito_post_confirmation_logs" {
  name              = "/aws/lambda/${aws_lambda_function.cognito_post_confirmation.function_name}"
  retention_in_days = 7
}

resource "aws_lambda_permission" "allow_cognito_post_confirmation" {
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.pool.arn
}
