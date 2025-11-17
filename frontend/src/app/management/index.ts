// Re-export all management components from their respective folders
export * from './games';
export * from './loaders';
export * from './changelog';
export * from './notifications';
export * from './files';
export * from './license-keys';

// Main management page
export { default as ManagementPage } from './management-page';

// Legacy exports for backward compatibility
export { default as PriceManager } from './PriceManager';
export { default as UsersManagement } from './users-management'; 