/* Theme is applied in the head, before page paint. No storage is required. */
(function () {
    'use strict';
    if (window.Chart && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation = false;
    var saved;
    try {
        saved = localStorage.getItem('theme');
        if (!saved && localStorage.getItem('light-mode') !== null)
            saved = localStorage.getItem('light-mode') === 'true' ? 'light' : 'dark';
    } catch (_) {}
    var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    var light = saved ? saved === 'light' : !!(media && media.matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    function apply() {
        document.documentElement.dataset.theme = light ? 'light' : 'dark';
        document.body.classList.toggle('light', light);
        document.body.classList.toggle('light-mode', light);
        var button = document.getElementById('themeToggle') || document.getElementById('themeBtn');
        if (button) {
            button.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
            button.setAttribute('aria-pressed', String(light));
            if (button.id === 'themeToggle') button.textContent = light ? 'Dark Mode' : 'Light Mode';
        }
        var icon = document.getElementById('themeIco');
        if (icon) icon.setAttribute('d', light
            ? 'M7.5 1.5A6 6 0 1012.5 13 4.5 4.5 0 017.5 1.5z'
            : 'M7.5 1v1M7.5 13v1M1 7.5H0M15 7.5h-1M3.05 3.05l-.7-.7M12.65 12.65l-.7-.7M3.05 11.95l-.7.7M12.65 2.35l-.7.7M7.5 4.5a3 3 0 100 6 3 3 0 000-6z');
        if (window.Chart && Chart.instances) Object.values(Chart.instances).forEach(function (chart) {
            var color = light ? '#445566' : '#a0adb8';
            if (chart.options.plugins.legend) chart.options.plugins.legend.labels.color = color;
            Object.values(chart.options.scales || {}).forEach(function (axis) {
                if (axis.ticks) axis.ticks.color = color;
                if (axis.title) axis.title.color = color;
                if (axis.grid) axis.grid.color = light ? '#dce2e8' : '#2a3f5a';
            });
            chart.update('none');
        });
        window.dispatchEvent(new Event('themechange'));
    }
    document.addEventListener('DOMContentLoaded', function () {
        apply();
        var button = document.getElementById('themeToggle') || document.getElementById('themeBtn');
        if (button) button.addEventListener('click', function () {
            light = !light; saved = light ? 'light' : 'dark';
            try { localStorage.setItem('theme', saved); } catch (_) {}
            apply();
        });
        // Give generated toggle controls meaningful states, including later changes.
        function states() {
            document.querySelectorAll('button[class*="chip"],button.tl-btn,button.fx-btn,button.graph-btn,button.fx-tab').forEach(function (b) {
                var selected = String(b.classList.contains('on') || b.classList.contains('active'));
                b.setAttribute(b.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed', selected);
            });
        }
        states();
        new MutationObserver(states).observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
        document.querySelectorAll('canvas').forEach(function (c) {
            if (!c.getAttribute('aria-label')) c.setAttribute('aria-label', 'Schematic educational chart; see adjacent explanation.');
            c.setAttribute('role', 'img');
        });
    });
    if (media && media.addEventListener) media.addEventListener('change', function (e) {
        if (!saved) { light = e.matches; if (document.body) apply(); }
    });
})();
