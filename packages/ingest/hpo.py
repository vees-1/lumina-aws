"""Load HPO ontology (hp.obo + phenotype.hpoa) into orpha.sqlite."""

import pyhpo
from sqlmodel import Session, delete

from ingest.db import DATA_DIR, init_db
from ingest.models import HPOAncestor, HPOTerm

HPO_DIR = str(DATA_DIR / "hpo")


def load_hpo(session: Session) -> int:
    session.exec(delete(HPOAncestor))
    session.exec(delete(HPOTerm))
    session.commit()

    pyhpo.Ontology(HPO_DIR)

    terms, ancestors = [], []
    for term in pyhpo.Ontology:
        hpo_id = term.id
        ic = term.information_content.orpha
        terms.append(HPOTerm(hpo_id=hpo_id, name=term.name, definition=None, ic=ic if ic and ic > 0 else None))

        for ancestor in term.all_parents:
            if ancestor.id != hpo_id:
                ancestors.append(HPOAncestor(hpo_id=hpo_id, ancestor_id=ancestor.id))

    session.add_all(terms)
    session.commit()
    print(f"  hpo_term: {len(terms)} terms")

    # bulk insert ancestors in chunks to avoid hitting sqlite limits
    chunk = 500
    for i in range(0, len(ancestors), chunk):
        session.add_all(ancestors[i : i + chunk])
        session.commit()
    print(f"  hpo_ancestor: {len(ancestors)} ancestor pairs")

    return len(terms)


def run():
    print("Loading HPO ontology...")
    engine = init_db()
    with Session(engine) as session:
        load_hpo(session)
    print("HPO done.")


if __name__ == "__main__":
    run()
