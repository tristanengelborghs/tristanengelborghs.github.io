# Thesis results used in the portfolio

Source: Tristan Engelborghs, *Lokalisatie van de epileptogene zone en voorspelling van chirurgische uitkomsten met machine learning op basis van intracraniële EEG*, KU Leuven, 2025–2026. Page numbers below are printed thesis page numbers.

- **0.878 mean AUROC, 0.835 mean AUPRC, 0.747 mean precision-at-k:** §4.2, Table 4.1, p. 21. Soft-voting ensemble evaluated with leave-one-patient-out validation on 13 Gent patients with Engel I outcome. The website reproduces all 13 anonymised result rows, including P003 (AUROC 0.048).
- **0.86 surgical-outcome AUROC:** §4.6, p. 28. Resection Alignment Score (RAS) as the sole predictor of postoperative seizure freedom; Gent cohort of 20 patients. This is a separate patient-level task, not another localisation score.
- **Time-window results:** Table 4.4, p. 25. Peri-onset 0.878; pre/post-onset 0.873; interictal 0.821; pre/post-onset + interictal 0.876; pre/post-onset + interictal + offset 0.883. Differences were not significant after Holm correction. Keep the final baseline as the headline, rather than selecting the highest exploratory variant.
- **Five selected features and model family:** §§3.3, 4.1 and 4.4. Ensemble of SVM, random forest, LDA, logistic regression and XGBoost. The final thesis results should not be attributed to the deep-learning architectures previously described on the site.
- **Scope and limitations:** §§5.1–5.3, pp. 31–33. Headline results are from Gent, not a pooled two-centre validation. The public HUP dataset supports additional feature analysis. Resection in seizure-free patients is a proxy reference, the cohort is small, and patient-level performance varies substantially.

The landing page introduces Tristan and links directly to each project. No raw recordings or full thesis PDF are included in the website.
