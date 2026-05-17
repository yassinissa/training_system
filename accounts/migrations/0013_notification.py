from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_user_profile_picture'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(
                    choices=[
                        ('EXAM_GRADED', 'Exam graded'),
                        ('EXAM_PASSED', 'Exam passed'),
                        ('EXAM_FAILED', 'Exam failed'),
                        ('GENERIC', 'Notification'),
                    ],
                    default='GENERIC',
                    max_length=20,
                )),
                ('title', models.CharField(max_length=255)),
                ('body', models.TextField(blank=True)),
                ('link', models.CharField(blank=True, max_length=255)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='notifications',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', 'is_read'], name='accounts_no_user_id_isread_idx'),
        ),
    ]
