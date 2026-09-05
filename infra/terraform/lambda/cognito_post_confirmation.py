import boto3


cognito = boto3.client("cognito-idp")


def handler(event, context):
    metadata = event.get("request", {}).get("clientMetadata") or {}
    role = metadata.get("role", "patient")
    if role not in {"doctor", "patient"}:
        role = "patient"

    cognito.admin_add_user_to_group(
        UserPoolId=event["userPoolId"],
        Username=event["userName"],
        GroupName=role,
    )
    return event
