# Engineering Notes - starter website

A free website for **books and articles**, built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
and published on **GitHub Pages**. You write plain Markdown files; GitHub builds and publishes the site
every time you upload (push) changes.

```
engineering-notes/
├── mkdocs.yml                  site settings, menu (nav) and extensions
├── requirements.txt            Python packages for building the site
├── .github/workflows/deploy.yml   builds and publishes the site on GitHub
├── docs/
│   ├── index.md                home page
│   ├── about.md, tools.md      other pages
│   ├── book/                   the book: one file per chapter
│   ├── blog/posts/             the articles: one file per article
│   └── assets/                 images, colours (extra.css), equations (mathjax.js)
└── scripts/make_figures.py     makes the sample figures with Python
```

## 1. See the site on your computer

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
mkdocs serve
```
Open http://127.0.0.1:8000. The page updates whenever you save a file.
(Equations need an internet connection: MathJax is loaded from the web.)

## 2. Replace the placeholders

| Where | What to change |
|---|---|
| `mkdocs.yml` | `site_url`: replace `YOUR-USERNAME` with your GitHub user name; `site_name`, `copyright` |
| `docs/tools.md` | `https://YOUR-APP.streamlit.app` -> the address of your web app |
| `docs/about.md` | the biography and the contact line |
| `docs/index.md` | the introduction text and the sample-site note |

## 3. Publish it for free on GitHub Pages

1. Create a free account on https://github.com.
2. Click **New repository**, name it `engineering-notes`, choose **Public** (GitHub Pages needs a public
   repository on the free plan - the website is public anyway), and create it empty.
3. In this folder run:
   ```bash
   git init
   git add .
   git commit -m "First version of the website"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/engineering-notes.git
   git push -u origin main
   ```
4. On GitHub open **Settings -> Pages -> Build and deployment -> Source** and choose **GitHub Actions**.
5. Open the **Actions** tab. After one or two minutes the workflow "Deploy site to GitHub Pages" turns green.
6. Your site is at `https://YOUR-USERNAME.github.io/engineering-notes/`.

From now on: save your changes, then `git add .`, `git commit -m "message"`, `git push`. The site updates by itself.

## 4. Write your content

**A new article:** add a file such as `docs/blog/posts/my-article.md`:

```markdown
---
date: 2026-11-05
categories:
  - Worked examples
---

# Title of the article

Short introduction that appears in the list of articles.

<!-- more -->

The rest of the article ...
```

**A new book chapter:** add `docs/book/04-my-chapter.md`, then add one line to the `nav:` list in `mkdocs.yml`:

```yaml
      - 4. My chapter: book/04-my-chapter.md
```

**Useful Markdown**

| You want | You write |
|---|---|
| Inline equation | `$\chi = N_{b,Rd}/N_{pl}$` |
| Display equation | `$$ \bar\lambda = \sqrt{A f_y / N_{cr}} $$` |
| Figure | `![description](../assets/images/figure.png)` |
| Note / warning box | `!!! note "Title"` followed by an indented text |
| Table | rows separated by `|` (see the sample chapters) |
| Code with tabs | `=== "Python"` followed by an indented code block |

**Figures made with Python:** edit `scripts/make_figures.py`, run `python scripts/make_figures.py`
(needs `pip install matplotlib numpy`) and use the PNG files from `docs/assets/images/`.

**A PDF of a page or chapter:** open the page in the browser and use *Print -> Save as PDF*.

## 5. Good to know

- **Free limits.** GitHub Pages allows sites up to 1 GB with a soft limit of 100 GB bandwidth per month,
  and it is not meant for selling things directly from the site. Check GitHub's current terms if your site
  grows. Cloudflare Pages is a free alternative: connect the same repository, build command
  `mkdocs build`, output folder `site`.
- **Own domain.** A name such as `yourname.com` costs a few dollars a year (not free). Add it under
  Settings -> Pages -> Custom domain, then change `site_url` in `mkdocs.yml`.
- **Copyright.** The site says "All rights reserved" (see `LICENSE.txt`). Do not copy text, tables or figures
  from design standards or textbooks into your pages; write your own explanation and refer to the clause.
- **Versions.** `requirements.txt` keeps MkDocs below 2.0 because Material for MkDocs announced that
  MkDocs 2.0 will not be compatible. The workflow uses current GitHub Actions versions; GitHub shows a
  notice in the Actions tab if one of them needs an update.
- **If the build fails** on GitHub: open the failed run in the Actions tab and read the red line. The same
  check runs on your computer with `mkdocs build --strict`.
