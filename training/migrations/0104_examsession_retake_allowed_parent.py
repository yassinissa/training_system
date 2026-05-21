from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("training", "0103_levelthresholdsetting"),
    ]

    operations = [
        migrations.AddField(
            model_name="examsession",
            name="retake_allowed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="examsession",
            name="parent_session",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="retakes",
                to="training.examsession",
            ),
        ),
    ]
