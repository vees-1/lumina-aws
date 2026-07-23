from api.ai_provider import (
    BedrockProvider,
    DemoProvider,
    get_ai_provider,
    validate_hpo_terms,
)


def test_demo_provider_extraction_and_letter():
    provider = DemoProvider()
    terms = provider.extract_hpo_terms("Patient has seizures")
    assert len(terms) > 0
    assert any(t["hpo_id"] == "HP:0001250" for t in terms)

    case_data = {
        "patientContext": {"patientName": "Jane Doe"},
        "hpoTerms": terms,
        "modalities": ["Clinical Notes"],
        "rankings": [{"name": "Epilepsy"}],
    }
    letter = provider.generate_letter(case_data, {})
    assert "Jane Doe" in letter
    assert "Epilepsy" in letter


def test_hpo_validation():
    hpo_vocab = {"HP:0001250": "Seizures"}
    raw_terms = [
        {"hpo_id": "HP:0001250", "name": "Seizures"},
        {"hpo_id": "HP:9999999", "name": "Hallucinated Term"},
    ]
    validated = validate_hpo_terms(raw_terms, hpo_vocab)
    assert len(validated) == 1
    assert validated[0]["hpo_id"] == "HP:0001250"


def test_ai_provider_factory_default(monkeypatch):
    monkeypatch.delenv("LUMINA_AI_PROVIDER", raising=False)
    provider = get_ai_provider()
    assert isinstance(provider, DemoProvider)


def test_ai_provider_factory_bedrock(monkeypatch):
    monkeypatch.setenv("LUMINA_AI_PROVIDER", "bedrock")
    provider = get_ai_provider()
    assert isinstance(provider, BedrockProvider)
