from django.db import migrations, models
import django.conf

class Migration(migrations.Migration):
    dependencies = [
        ("training", "0099_saved_views"),
    ]

    operations = [
        migrations.CreateModel(
            name="SchedulerSetting",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("enable_auto_reminders", models.BooleanField(default=False)),
                ("enable_scheduled_reports", models.BooleanField(default=False)),
                ("report_frequency", models.CharField(default="weekly", max_length=20)),
                ("last_run", models.DateTimeField(blank=True, null=True)),
                ("last_result", models.TextField(blank=True)),
                ("owner", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="scheduler_settings", to=django.conf.settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
