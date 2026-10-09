"""Navigation regression checks for the application-wide Back control."""

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class BackNavigationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = (ROOT / "frontend" / "assets" / "js" / "app.js").read_text(encoding="utf-8")
        cls.styles = (ROOT / "frontend" / "assets" / "css" / "app.css").read_text(encoding="utf-8")

    def test_every_workspace_view_uses_the_shared_back_control(self):
        self.assertIn("const pageBackControl = () =>", self.script)
        self.assertIn("page === 'home' ? html : `${pageBackControl()}${html}`", self.script)
        self.assertIn("page === 'home' ? '' : pageBackControl()", self.script)
        self.assertIn("data-action=\"navigate-back\"", self.script)

    def test_back_uses_previous_app_route_and_a_safe_default(self):
        self.assertIn("routeHistory.push(state.currentRouteKey)", self.script)
        self.assertIn("const fallback = state.user ? 'dashboard' : 'home'", self.script)
        self.assertIn("if(action==='navigate-back'){navigateBack();return;}", self.script)
        self.assertIn("state.skipRouteHistoryOnce = true", self.script)

    def test_public_non_home_pages_also_receive_a_back_control(self):
        self.assertIn("if (publicPath !== 'home')", self.script)
        self.assertIn("back.className = 'page-back-button public-back-button'", self.script)

    def test_authentication_and_recovery_screens_receive_the_shared_back_button(self):
        self.assertIn("function addAuthPageBackControl()", self.script)
        self.assertEqual(self.script.count("addAuthPageBackControl();"), 3)
        self.assertIn(".auth-page-back", self.styles)

    def test_back_control_keeps_shared_responsive_campuslink_styling(self):
        self.assertIn(".page-back-button", self.styles)
        self.assertIn(".public-back-button", self.styles)
        self.assertIn("@media(max-width:560px)", self.styles)


if __name__ == "__main__":
    unittest.main()
