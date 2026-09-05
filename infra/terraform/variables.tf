variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS Region for deployment"
}

variable "app_name" {
  type        = string
  default     = "lumina-aws"
  description = "Application name prefix"
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Deployment environment"
}

variable "github_repo" {
  type        = string
  default     = "vees-1/lumina-aws"
  description = "GitHub repository name"
}

variable "budget_email" {
  type        = string
  default     = "alerts@example.com"
  description = "Email address for AWS Budget alerts"
}

variable "web_origins" {
  type = list(string)
  default = [
    "https://lumina-dd.online",
    "https://www.lumina-dd.online",
    "https://d124bi3e327i7a.cloudfront.net",
    "http://localhost:3000",
  ]
  description = "Allowed browser origins for the API and direct uploads"
}
