from pathlib import Path

from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


def test_direct_links_refresh_and_assets(tmp_path: Path):
    """A bookmarked step must load without a previous visit to the home page."""
    settings = Settings(database_path=tmp_path / 'pages.db', knowledge_base_path=Path(__file__).resolve().parents[1] / 'app/data/knowledge_base.json', enable_llm=False)
    client = TestClient(create_app(settings))
    for route in ['/experiments', '/experiments/thin_lens', '/practice/thin_lens-standard', '/experiment', '/data', '/review', '/observations', '/checks', '/calculation', '/diagnosis', '/revision', '/history', '/library', '/help']:
        response = client.get(route)
        assert response.status_code == 200
        assert 'text/html' in response.headers['content-type']
        assert '/static/flow.js' in response.text
    for asset in ['flow.js', 'pages.css', 'academy.js', 'academy.css', 'academy-motion-electric.js', 'academy-motion-optics.js', 'academy-motion-matter.js', 'images/chalkboard-books.jpg', 'images/book-lightbulb.jpg', 'images/lab-desk.webp']:
        response = client.get('/static/' + asset)
        assert response.status_code == 200 and len(response.content) > 0
    # Deferred process modules must register before the shared animation controller executes.
    html = client.get('/data').text
    controller = html.index('/static/academy.js?')
    for module in ['electric', 'optics', 'matter']:
        assert html.index(f'/static/academy-motion-{module}.js?') < controller
    # Page routing must not turn unknown API paths into successful HTML responses.
    assert client.get('/api/v1/unknown').status_code == 404
    assert client.get('/unknown-page').status_code == 404
