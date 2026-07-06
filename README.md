# AI Learning Blog

A professional blog about deep learning fundamentals, covering activation functions, optimization techniques, and regularization strategies.

## Articles

- [Activation Functions: From Theory to Practice](articles/activation_functions.html) - Understanding the mechanics, advantages, and trade-offs of key activation functions
- [Optimization Techniques: Training Networks Faster](articles/optimization_techniques.html) - Practical optimization methods to accelerate neural network training
- [Regularization: Preventing Your Network from Overfitting](articles/regularization_techniques.html) - Techniques to improve generalization and prevent overfitting

## Features

- **Dark and Light Mode** - Toggle between dark and light themes
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Interactive Charts** - Using Chart.js for visual comparisons
- **Professional GitHub-style Design** - Clean, modern aesthetic
- **No External Dependencies** - Except Chart.js CDN

## Project Structure

```
my-blog/
├─ index.html                          (homepage)
├─ README.md                           (this file)
├─ .gitignore
├─ LICENSE
│
├─ articles/
│  ├─ activation_functions.html
│  ├─ optimization_techniques.html
│  └─ regularization_techniques.html
│
└─ assets/
   └─ images/
```

## How to Run Locally

### Option 1: Python HTTP Server
```bash
cd my-blog
python -m http.server 8000
```
Then open your browser to: `http://localhost:8000`

### Option 2: Node.js http-server
```bash
npm install -g http-server
cd my-blog
http-server
```
Then open your browser to: `http://localhost:8080`

### Option 3: Direct in Browser
Simply open `index.html` in your web browser (some features may be limited).

## Deployment to GitHub Pages

1. Create a new repository on GitHub named `my-blog`
2. Clone the repository to your computer
3. Add all files to the repository
4. Push to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit: Blog portfolio with 3 deep learning articles"
   git push origin main
   ```
5. Go to **Settings → Pages**
6. Select **main** branch as source
7. Save

Your site will be live at: `https://YOUR_USERNAME.github.io/my-blog/`

## Adding More Articles

1. Create a new HTML file in the `articles/` folder
2. Use the same template structure as existing articles
3. Ensure the back link points to: `<a href="../index.html">`
4. Add a new card to `index.html` in the articles grid
5. Commit and push to GitHub

## File Naming Convention

Use **snake_case** (lowercase with underscores):
- `activation_functions.html` ✓
- `optimization_techniques.html` ✓
- `my_new_article.html` ✓

Not:
- `activation-functions.html` ✗
- `ActivationFunctions.html` ✗
- `Activation Functions.html` ✗

## Customization

### Change Colors
Edit the CSS `:root` variables at the top of any HTML file:
```css
:root {
    --bg-dark: #0f1e2e;      /* Background color */
    --accent: #00d9ff;       /* Accent/highlight color */
    --text-primary: #e8f0f5; /* Main text color */
}
```

### Update Author Info
In `index.html`, find the author card section and update:
- Title
- Bio/description
- Links

### Add Logo or Favicon
1. Place images in `assets/images/`
2. Reference them in HTML: `<img src="../assets/images/logo.png">`

## Technology Stack

- **HTML5** - Content structure
- **CSS3** - Styling and responsive design
- **JavaScript** - Theme toggle and interactivity
- **Chart.js** - Interactive charts (via CDN)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Created: February 2026

Feel free to use this as a template for your own blog or portfolio!

---

**Need help?**
- Check the [How to Run Locally](#how-to-run-locally) section
- Review the [Project Structure](#project-structure) section
- Customize the author card in `index.html`
- Add your own articles following the existing template
