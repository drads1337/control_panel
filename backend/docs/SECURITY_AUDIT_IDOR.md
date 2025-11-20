================================================================================
SECURITY AUDIT REPORT: IDOR / Multi-tenancy Isolation
================================================================================

SUMMARY
--------------------------------------------------------------------------------
Total endpoints checked: 367
Endpoints with protection: 314
Endpoints without protection: 48
Potentially vulnerable endpoints: 0

✓ No vulnerable endpoints found!

ENDPOINTS WITHOUT PROJECT ISOLATION (FOR REVIEW)
--------------------------------------------------------------------------------
These endpoints require authentication but don't use project isolation decorators.
Verify they don't access project-scoped data or are admin-only endpoints.

  routes/admin/system.py:44 - /settings (get_system_settings)
  routes/admin/system.py:72 - /settings/<setting_type> (update_system_settings)
  routes/admin/system.py:129 - /info (get_system_info)
  routes/admin/system.py:170 - /backup (get_backups)
  routes/admin/system.py:203 - /backup (create_backup)
  routes/admin/users.py:386 - /invite (invite_user)
  routes/admin_main.py:23 - /projects/deactivate-expired (deactivate_expired_projects)
  routes/admin_main.py:62 - /projects/cleanup-expired (cleanup_expired_projects)
  routes/admin_main.py:101 - /system/stats (get_system_stats)
  routes/admin_main.py:131 - /projects/expired (get_expired_projects)
  routes/admin_main.py:158 - /projects/<int:project_id>/suspend (suspend_project)
  routes/admin_main.py:191 - /projects/<int:project_id>/reactivate (reactivate_project)
  routes/profile.py:85 - /me (get_me)
  routes/profile.py:150 - /update (update_profile)
  routes/profile.py:194 - /change_password (change_password)
  routes/profile.py:255 - /avatar (upload_avatar)
  routes/profile.py:328 - /avatar (remove_avatar)
  routes/projects.py:135 - /projects (create_project)
  routes/projects.py:265 - /projects/<int:project_id> (delete_project)
  routes/users/profile.py:84 - /me (get_me)
  routes/users/profile.py:190 - /profile (update_profile)
  routes/users/profile.py:235 - /change_password (change_password)
  routes/users/profile.py:296 - /avatar (upload_avatar)
  routes/users/profile.py:369 - /avatar (remove_avatar)
  routes/websocket.py:104 - /task-status/<task_id> (get_task_status)
  routes/websocket.py:124 - /user-tasks (get_user_tasks)

RECOMMENDATIONS
--------------------------------------------------------------------------------
1. Add @require_project_isolation to all endpoints that access project-scoped data
2. Use @enforce_project_scope for endpoints where owners can access multiple projects
3. Always filter database queries by project_id using g.project_id from decorators
4. Use ensure_project_isolation() utility function for manual query filtering
5. Add integration tests to verify project isolation for all endpoints
6. Consider using a base service class that automatically filters by project_id

================================================================================