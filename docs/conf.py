# Configuration file for the Sphinx documentation builder.
# https://www.sphinx-doc.org/en/master/usage/configuration.html

project = "Badgerswap v3"
author = "Yunqi Li, Deepak Maram, Mark Jabbour, Sylvain Bellemare, Paolo Marin"
copyright = f"2021, {author}"

extensions = [
    "sphinxcontrib.bibtex",
    "sphinx_proof",
    "sphinx_togglebutton",
]

bibtex_bibfiles = ["refs.bib"]

templates_path = ["_templates"]

exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

html_theme = "sphinx_book_theme"
html_title = f"{project}"
html_static_path = ["_static"]
