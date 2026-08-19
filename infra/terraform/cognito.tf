resource "aws_cognito_user_pool" "pool" {
  name = "${var.app_name}-${var.environment}-user-pool"

  auto_verified_attributes = ["email"]

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

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  allowed_oauth_flows                  = ["implicit", "code"]
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
