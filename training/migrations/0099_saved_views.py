from django.db import migrations, models
import django.conf

class Migration(migrations.Migration):
    dependencies = [
        ("training", "0011_alter_positioncompetencyrequirement_unique_together"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedView",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("export_type", models.CharField(choices=[("compliance", "Compliance"), ("sessions", "Sessions")], default="compliance", max_length=32)),
                ("filters_json", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("owner", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="saved_views", to=django.conf.settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
