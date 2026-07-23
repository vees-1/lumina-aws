output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.cdn.domain_name
  description = "CloudFront Distribution Domain"
}

output "api_gateway_url" {
  value       = aws_apigatewayv2_api.http_api.api_endpoint
  description = "HTTP API Gateway URL"
}

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.pool.id
  description = "Cognito User Pool ID"
}

output "cognito_client_id" {
  value       = aws_cognito_user_pool_client.client.id
  description = "Cognito App Client ID"
}

output "cognito_domain" {
  value       = "https://${aws_cognito_user_pool_domain.domain.domain}.auth.${var.aws_region}.amazoncognito.com"
  description = "Cognito Hosted UI Domain"
}

output "github_deploy_role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "GitHub Actions OIDC Deploy Role ARN"
}
