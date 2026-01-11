from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("branches", "0003_alter_branch_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="target_compliance_percent",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
