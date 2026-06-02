# imports_feedbacks/

Dossier de transit pour les exports CSV des Google Forms de feedback formation.

## Workflow
1. Télécharger le CSV des réponses d'une session depuis Google Sheets
2. Renommer en `feedback_F-YYYY-NNN.csv` selon l'id_session correspondant
3. Déposer dans ce dossier
4. Lancer `python3 scripts/import_feedbacks.py`
5. Commit le xlsx mis à jour, pas les CSV

## Important
Les .csv sont gitignorés : ce sont des données sensibles (verbatims de
consultants) qui ne doivent pas vivre dans l'historique git permanent. La
source de vérité est l'onglet Formation_Feedbacks du xlsx.
