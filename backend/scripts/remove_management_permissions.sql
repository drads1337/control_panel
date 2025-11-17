-- Script to remove management tab permissions from database
-- Run this with: psql -d your_database -f backend/scripts/remove_management_permissions.sql

BEGIN;

-- Delete role_permission associations first
DELETE FROM role_permission
WHERE permission_id IN (
    SELECT id FROM permission 
    WHERE name IN (
        'loaders.manage_changelog',
        'loaders.manage_notifications',
        'games.manage_changelog',
        'games.manage_notifications'
    )
);

-- Delete the permissions themselves
DELETE FROM permission
WHERE name IN (
    'loaders.manage_changelog',
    'loaders.manage_notifications',
    'games.manage_changelog',
    'games.manage_notifications'
);

COMMIT;

-- Show results
SELECT 
    'Deleted permissions' as action,
    COUNT(*) as count
FROM permission
WHERE name IN (
    'loaders.manage_changelog',
    'loaders.manage_notifications',
    'games.manage_changelog',
    'games.manage_notifications'
);

