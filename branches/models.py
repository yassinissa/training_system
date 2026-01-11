from django.db import models

class Branch(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    # Target overall compliance percentage for this branch (0-100)
    target_compliance_percent = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name
