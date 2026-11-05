# AI/ML Learning Blog

Articles on deep learning fundamentals, with interactive visualizations you can run in the browser. Published as a static site on GitHub Pages at `https://egigj-dev.github.io/my-blog/`.

## Articles

| Article | Topic | Interactive feature |
| --- | --- | --- |
| [Backpropagation and Autodiff](articles/backpropagation.html) | Foundations | Live forward and backward values for one neuron |
| [Activation Functions](articles/activation-functions.html) | Foundations | Function and derivative explorer |
| [Optimization Techniques](articles/optimization-techniques.html) | Training | Optimizers on a synthetic 3D loss surface |
| [Regularization Techniques](articles/regularization-techniques.html) | Training | L1 and L2 constraint geometry, dropout subnetworks |
| [Data Augmentation](articles/data-augmentation.html) | Training | Effect of transforms on a synthetic decision boundary |
| [AlexNet Paper Walkthrough](articles/alexnet-paper.html) | Computer vision | 3D architecture and parameter breakdown |
| [Transfer Learning for CIFAR-10](articles/cifar10-transfer-learning.html) | Computer vision | Synthetic latent space with a linear probe |
| [Model Evaluation and Calibration](articles/model-evaluation-calibration.html) | Evaluation | Reliability diagram with temperature scaling, on synthetic data |

## How results are labelled

Articles distinguish paper results, the author's reported project results, values computed from synthetic data, and schematic charts. The CIFAR-10 training chart is schematic, and the project figures in that article are author-reported, with no published logs. Keep these labels accurate when editing.

## Project structure

```
index.html              Homepage, article cards, topic graph section and fallback list
articles/               One self-contained HTML page per article
assets/brain-graph.js   Topic graph data and rendering; add new articles here
assets/viz-core.js      Shared helpers for the article visualizations
assets/*.js             One visualization module per article
scripts/check_site.py   Static link, graph and JavaScript syntax checks
```

## Browser dependencies

There is no build step, but some scripts and fonts load from CDNs:

- Homepage: GSAP and ScrollTrigger (optional animation), Google Fonts. The topic graph has no library dependency.
- Articles: D3, GSAP, Chart.js and Three.js, depending on the article.

If a CDN is unavailable, the homepage and its article links still work. Interactive figures in articles may not render.

## Local preview

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Adding an article

1. Create `articles/your-article.html`, using an existing article as a template.
2. Add a card to `.art-grid` in `index.html`.
3. Add it to the fallback list in `index.html` and to `graph.nodes` in `assets/brain-graph.js`, with any relationships it has.
4. Run `python3 scripts/check_site.py`.

## Deployment

The site deploys from the root of `main` through GitHub Pages.

## Known limitations

- The newsletter form on the homepage is a placeholder and does not submit anywhere.
- On screens under 600 px, the topic graph is replaced by a grouped article list.
- Article pages have not been fully reviewed for keyboard and screen-reader use.

## Author

**Egi Gjineci**, AI/ML Engineer at Credins Bank, Tirana, Albania.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
