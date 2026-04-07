from locust import HttpUser, task, between

class SpatialDashboardUser(HttpUser):
    wait_time = between(1, 3)
    
    # ⚠️ REPLACE THIS with your actual Google Cloud Run URL!
    host = "https://final-project-app-881359184105.asia-south1.run.app"

    @task(1)
    def load_homepage(self):
        """Test the UI loading speed."""
        self.client.get("/")

    @task(3)
    def test_heavy_inference(self):
        """Test the live ML inference speed on GCP."""
        payload = {
            "latitude": 18.5204,
            "longitude": 73.8567
        }
        # Tests the backend inference engine
        self.client.post("/predict", json=payload)