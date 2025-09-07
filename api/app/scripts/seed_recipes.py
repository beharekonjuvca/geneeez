# app/scripts/seed_recipes.py
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import AnalysisRecipeTemplate
from app.config import settings
print("DATABASE_URL ->", settings.DATABASE_URL)


def main():
    print("Connecting to DB…")
    db: Session = SessionLocal()
    try:
        existing = db.query(AnalysisRecipeTemplate).count()
        print(f"analysis_recipe_templates rows before: {existing}")

        if existing == 0:
            print("Seeding templates…")
            db.add_all([
                AnalysisRecipeTemplate(
                    key="correlation",
                    display_name="Correlation Matrix",
                    description="Pearson/Spearman correlation with heatmap",
                    params_schema={"properties":{
                        "method":{"type":"string","enum":["pearson","spearman"],"default":"spearman"},
                        "max_features":{"type":"integer","default":300}
                    }},
                ),
                AnalysisRecipeTemplate(
                    key="pca",
                    display_name="PCA",
                    description="Standardize → PCA → scree + scatter",
                    params_schema={"properties":{"n_components":{"type":"integer","default":10}}},
                ),
                AnalysisRecipeTemplate(
                    key="de",
                    display_name="Differential Expression",
                    description="Two-group t-test + BH-FDR",
                    params_schema={"properties":{
                        "group_col":{"type":"string","default":"group"},
                        "alpha":{"type":"number","default":0.05}
                    }},
                ),
            ])
            db.commit()
            print("Seeded analysis_recipe_templates")
        else:
            print("Templates already present, skipping")

        afterwards = db.query(AnalysisRecipeTemplate).count()
        print(f"analysis_recipe_templates rows after: {afterwards}")

       
        for row in db.query(AnalysisRecipeTemplate).all():
            print(f"- {row.key} → {row.display_name}")

    except Exception as e:
        print("Seeding failed:", repr(e))
        raise
    finally:
        db.close()
        print("Done.")

if __name__ == "__main__":
    main()
