resource "aws_sqs_queue" "dlq" {
  name                      = "${var.app_name}-${var.environment}-jobs-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "jobs" {
  name = "${var.app_name}-${var.environment}-jobs"
  # Lambda timeout is 60 seconds. Six times that avoids duplicate processing.
  visibility_timeout_seconds = 360

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}
