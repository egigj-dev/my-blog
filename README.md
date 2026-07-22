# AI/ML Learning Blog

A deep learning fundamentals blog covering neural networks, activation functions, optimization techniques, regularization, computer vision, and transfer learning. Built with HTML, CSS, and JavaScript — no frameworks, no build tools.

## Articles

- [Activation Functions](articles/activation-functions.html) — ReLU, Sigmoid, Tanh, Softmax explained with interactive comparisons
- [Optimization Techniques](articles/optimization-techniques.html) — Feature scaling, batch norm, momentum, RMSProp, Adam, LR decay
- [Regularization Techniques](articles/regularization-techniques.html) — L1, L2, Dropout, Data Augmentation, Early Stopping
- [Transfer Learning for CIFAR-10](articles/cifar10-transfer-learning.html) — EfficientNetB0 frozen backbone, 87–89% accuracy in under 3 minutes
- [AlexNet Paper Walkthrough](articles/alexnet-paper.html) — Deep dive into the architecture that sparked modern deep learning
- [Data Augmentation](articles/data-augmentation.html) — Techniques to expand your dataset and improve generalization

## Features

- **Dark / Light mode** — persists across sessions via localStorage
- **Interactive mind map** — click any topic node to jump to its article
- **Responsive grid layout** — works on desktop, tablet, and mobile
- **Typography** — Syne (headings), Lora (body), JetBrains Mono (code)
- **Zero external dependencies** — no CDNs, no build tools, no frameworks
- **GitHub Pages ready** — push to `main`, enable Pages, and it's live

## Project Structure

```
my-blog/
├── index.html                  (homepage with mind map + article grid)
├── README.md
├── favicon.svg
├── .gitignore
├── LICENSE
│
├── articles/
│   ├── activation-functions.html
│   ├── optimization-techniques.html
│   ├── regularization-techniques.html
│   ├── cifar10-transfer-learning.html
│   ├── alexnet-paper.html
│   └── data-augmentation.html
│
└── assets/
    ├── alexnet-architecture.png
    ├── alexnet-architecture-2.png
    ├── data-aug-example.png
    └── data-aug-example-2.png
```

## Run Locally

```bash
cd my-blog
python3 -m http.server 8000
# → http://localhost:8000
```

Or with Node:

```bash
npx serve .
```

## Add a New Article

1. Create a new `.html` file in `articles/` (use an existing one as a template)
2. The back link at the top should point to `../index.html`
3. Add a card to the `.art-grid` in `index.html`
4. Add a node to the SVG mind map (optional)
5. Commit and push

## File Naming Convention

Use **kebab-case** (lowercase with hyphens):

- `activation-functions.html` ✓
- `cifar10-transfer-learning.html` ✓
- `my-new-article.html` ✓

## Deployment

Push to `main` on GitHub. In Settings → Pages, select the `main` branch root. Your site is live at `https://egigj-dev.github.io/my-blog/`.

## Tech Stack

- HTML5 + CSS3 — no frameworks
- Vanilla JavaScript — theme toggle, interactive mind map
- SVG — knowledge graph visualization

## License

MIT — see [LICENSE](LICENSE).

## Author

**Egi Gjineci** — AI/ML Engineer at Credins Bank, Tirana, Albania