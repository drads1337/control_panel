# Дерево структуры frontend/src

```
src/
├── app/
│   ├── __tests__/
│   │   └── login.integration.test.tsx
│   ├── auth/
│   │   ├── auth-guard.tsx
│   │   ├── index.ts
│   │   ├── login-form.tsx
│   │   ├── login-page.tsx
│   │   ├── signup-form.tsx
│   │   └── signup-page.tsx
│   ├── dashboard/
│   │   ├── chart-area-interactive.tsx
│   │   ├── dashboard-page-wrapper.tsx
│   │   ├── dashboard-page.tsx
│   │   ├── data-table.tsx
│   │   ├── error-state.tsx
│   │   ├── index.ts
│   │   ├── load-status-card.tsx
│   │   ├── loading-state.tsx
│   │   ├── owner-dashboard-wrapper.tsx
│   │   ├── owner-load-status-card.tsx
│   │   ├── protected-dashboard-components.tsx
│   │   ├── session-stats-charts.tsx
│   │   ├── slow-queries-card.tsx
│   │   ├── smart-dashboard-router.tsx
│   │   ├── stat-card.tsx
│   │   ├── stat-cards-grid.tsx
│   │   └── user-dashboard.tsx
│   ├── index.ts
│   ├── logs/
│   │   ├── index.ts
│   │   ├── logs-page.tsx
│   │   ├── logs-search-filters.tsx
│   │   ├── logs-stats-cards.tsx
│   │   └── logs-table.tsx
│   ├── management/
│   │   ├── agents/
│   │   │   ├── AgentConfigDialog.tsx
│   │   │   ├── AgentDetailsDialog.tsx
│   │   │   ├── AgentManager.tsx
│   │   │   ├── AssignProductsDialog.tsx
│   │   │   ├── CreateAgentDialog.tsx
│   │   │   ├── EditAgentDialog.tsx
│   │   │   ├── index.ts
│   │   │   └── UploadAgentFilesDialog.tsx
│   │   ├── changelog/
│   │   │   ├── ChangelogFormDialog.tsx
│   │   │   ├── ChangelogManagementDialog.tsx
│   │   │   ├── ChangelogManager.tsx
│   │   │   └── index.ts
│   │   ├── files/
│   │   │   ├── FileManager.tsx
│   │   │   ├── index.ts
│   │   │   ├── MultiFileUploadDialog.tsx
│   │   │   └── UploadDialog.tsx
│   │   ├── index.ts
│   │   ├── license-keys/
│   │   │   ├── components/
│   │   │   │   ├── ActionButton.tsx
│   │   │   │   ├── BulkKeyForm.tsx
│   │   │   │   ├── BulkKeyOperationsForm.tsx
│   │   │   │   ├── BulkOperations/
│   │   │   │   │   ├── AdvancedFilters.tsx
│   │   │   │   │   ├── AgentSelector.tsx
│   │   │   │   │   ├── FilteredOperations.tsx
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── ProductSelector.tsx
│   │   │   │   │   ├── QuickOperations.tsx
│   │   │   │   │   └── TargetTypeSelector.tsx
│   │   │   │   ├── CustomKeyForm.tsx
│   │   │   │   ├── index.ts
│   │   │   │   ├── KeyActions.tsx
│   │   │   │   ├── KeyDisplay.tsx
│   │   │   │   ├── KeyRow.tsx
│   │   │   │   ├── KeyVisibilityToggle.tsx
│   │   │   │   └── SingleKeyForm.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-duration.ts
│   │   │   │   └── use-key-form.ts
│   │   │   ├── index.ts
│   │   │   ├── KeyDetailsDialog.tsx
│   │   │   ├── KeyEditDialog.tsx
│   │   │   ├── KeyExtendDialog.tsx
│   │   │   ├── LicenseKeyCreationGrid.tsx
│   │   │   ├── LicenseKeysFilters.tsx
│   │   │   ├── LicenseKeysList.tsx
│   │   │   └── LicenseKeysMain.tsx
│   │   ├── management-access-denied.tsx
│   │   ├── management-dialogs.tsx
│   │   ├── management-page-content.tsx
│   │   ├── management-page-header.tsx
│   │   ├── management-page.tsx
│   │   ├── management-stat-card.tsx
│   │   ├── management-stats-cards.tsx
│   │   ├── management-stats.tsx
│   │   ├── management-tabs.tsx
│   │   ├── ManagementTabContent.tsx
│   │   ├── notifications/
│   │   │   ├── CreateNotificationDialog.tsx
│   │   │   ├── index.ts
│   │   │   ├── NotificationsDialog.tsx
│   │   │   └── NotificationsManager.tsx
│   │   ├── PriceManager.tsx
│   │   ├── products/
│   │   │   ├── BulkActionsPanel.tsx
│   │   │   ├── components/
│   │   │   │   ├── index.ts
│   │   │   │   ├── ProductActions.tsx
│   │   │   │   ├── ProductRow.tsx
│   │   │   │   ├── ProductSelectionCheckbox.tsx
│   │   │   │   ├── ProductsList.tsx
│   │   │   │   └── ProductsVirtualizedList.tsx
│   │   │   ├── CreateProductDialog.tsx
│   │   │   ├── EditProductDialog.tsx
│   │   │   ├── index.ts
│   │   │   ├── ProductDatabase.tsx
│   │   │   ├── ProductDatabaseAccessDenied.tsx
│   │   │   ├── ProductDatabaseDialogs.tsx
│   │   │   ├── ProductDatabaseEmptyState.tsx
│   │   │   ├── ProductDatabaseErrorState.tsx
│   │   │   ├── ProductFileUploadDialog.tsx
│   │   │   ├── ProductsTable.tsx
│   │   │   └── ViewProductDialog.tsx
│   │   └── users-management.tsx
│   ├── not-found/
│   │   └── not-found-page.tsx
│   ├── owner-dashboard/
│   │   ├── index.ts
│   │   ├── owner-dashboard-page.tsx
│   │   └── owner-dashboard.tsx
│   ├── profile/
│   │   ├── avatar-crop-dialog.tsx
│   │   ├── index.ts
│   │   ├── profile-card.tsx
│   │   ├── profile-general-tab.tsx
│   │   ├── profile-page.tsx
│   │   └── profile-security-tab.tsx
│   ├── projects/
│   │   ├── create-project-dialog.tsx
│   │   ├── index.ts
│   │   ├── invite-code-manager.tsx
│   │   ├── invite-codes-page.tsx
│   │   ├── project-card.tsx
│   │   ├── project-deleted-screen.tsx
│   │   ├── project-invite-code-manager.tsx
│   │   ├── project-management-dialog.tsx
│   │   ├── projects-navigation.tsx
│   │   └── projects-page.tsx
│   ├── providers/
│   │   ├── AppProviders.tsx
│   │   └── index.ts
│   ├── remote-control/
│   │   ├── category-dialog.tsx
│   │   ├── category-tabs.tsx
│   │   ├── feature-dialogs.tsx
│   │   ├── feature-list.tsx
│   │   ├── index.ts
│   │   ├── remote-control-page.tsx
│   │   ├── remote-control-stats-cards.tsx
│   │   └── remote-control-tabs.tsx
│   ├── security/
│   │   ├── add-hwid-block.tsx
│   │   ├── add-ip-block.tsx
│   │   ├── AddBlockDialog.tsx
│   │   ├── blocked-hwids-list.tsx
│   │   ├── blocked-ips-list.tsx
│   │   ├── components/
│   │   │   ├── BlockFormFields.tsx
│   │   │   └── BlockFormValidation.ts
│   │   ├── hooks/
│   │   │   ├── use-security-actions.ts
│   │   │   ├── useBlockDialogConfig.ts
│   │   │   └── useBlockForm.ts
│   │   ├── index.ts
│   │   ├── security-access-denied.tsx
│   │   ├── security-page.tsx
│   │   ├── security-rules.tsx
│   │   ├── security-stats-cards.tsx
│   │   └── security-tabs.tsx
│   ├── servers/
│   │   ├── index.ts
│   │   └── servers-page.tsx
│   ├── sessions/
│   │   ├── index.ts
│   │   ├── session-details-dialog.tsx
│   │   ├── session-stats-cards.tsx
│   │   ├── sessions-page.tsx
│   │   ├── sessions-search.tsx
│   │   ├── sessions-table.tsx
│   │   └── sessions-tabs.tsx
│   ├── settings/
│   │   ├── appearance-settings.tsx
│   │   ├── cryptographic-keys.tsx
│   │   ├── current-project-info.tsx
│   │   ├── index.ts
│   │   ├── offline-auth-settings.tsx
│   │   ├── payment-modal.tsx
│   │   ├── payment-required-screen.tsx
│   │   ├── projects-list.tsx
│   │   └── settings-page.tsx
│   ├── shared/
│   │   ├── app-footer.tsx
│   │   ├── app-header.tsx
│   │   ├── app-layout.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── color-initializer.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── faulty-terminal.tsx
│   │   ├── guest-layout.tsx
│   │   ├── index.ts
│   │   ├── page-transition.tsx
│   │   ├── pagination.tsx
│   │   ├── theme-provider.tsx
│   │   └── user-layout.tsx
│   ├── users/
│   │   ├── clients-tab.tsx
│   │   ├── create-referral-dialog.tsx
│   │   ├── create-role-dialog.tsx
│   │   ├── create-user-dialog.tsx
│   │   ├── edit-role-dialog.tsx
│   │   ├── edit-user-dialog.tsx
│   │   ├── employees-tab.tsx
│   │   ├── index.ts
│   │   ├── notification-dialog.tsx
│   │   ├── rbac-tab.tsx
│   │   ├── recent-activity-table.tsx
│   │   ├── referrals-tab.tsx
│   │   ├── user-activity-list.tsx
│   │   ├── user-activity-stats.tsx
│   │   ├── user-tokens-dialog.tsx
│   │   ├── users-filters.tsx
│   │   ├── users-list.tsx
│   │   ├── users-main.tsx
│   │   └── users-stats.tsx
│   └── webhooks/
│       ├── constants.ts
│       ├── create-webhook-dialog.tsx
│       ├── edit-webhook-dialog.tsx
│       ├── index.ts
│       ├── types.ts
│       ├── webhook-form.tsx
│       ├── webhook-logs-dialog.tsx
│       ├── webhook-stats.tsx
│       ├── webhook-table.tsx
│       └── webhooks-page.tsx
├── components/
│   ├── animate-ui/
│   │   ├── components/
│   │   │   ├── animate/
│   │   │   │   ├── tabs.tsx
│   │   │   │   └── tooltip.tsx
│   │   │   └── radix/
│   │   │       ├── sheet.tsx
│   │   │       ├── sidebar.tsx
│   │   │       └── tabs.tsx
│   │   └── primitives/
│   │       ├── animate/
│   │       │   ├── slot.tsx
│   │       │   └── tabs.tsx
│   │       ├── effects/
│   │       │   ├── auto-height.tsx
│   │       │   └── highlight.tsx
│   │       └── radix/
│   │           ├── checkbox.tsx
│   │           ├── collapsible.tsx
│   │           └── tabs.tsx
│   ├── error-boundary/
│   │   ├── ErrorBoundary.tsx
│   │   └── index.ts
│   ├── hoc/
│   │   └── with-role-guard.tsx
│   ├── index.ts
│   ├── rbac/
│   │   ├── conditional-render.tsx
│   │   ├── index.ts
│   │   ├── permission-guard.tsx
│   │   ├── rbac-example.tsx
│   │   └── route-guard.tsx
│   └── ui/
│       ├── accordion.tsx
│       ├── alert-dialog.tsx
│       ├── alert.tsx
│       ├── aspect-ratio.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── breadcrumb.tsx
│       ├── button.tsx
│       ├── calendar.tsx
│       ├── card.tsx
│       ├── carousel.tsx
│       ├── chart.tsx
│       ├── checkbox.tsx
│       ├── collapsible.tsx
│       ├── command.tsx
│       ├── context-menu.tsx
│       ├── custom-notification.tsx
│       ├── dialog.tsx
│       ├── drawer.tsx
│       ├── dropdown-menu.tsx
│       ├── file-upload.tsx
│       ├── form.tsx
│       ├── hover-card.tsx
│       ├── index.ts
│       ├── input-otp.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── Loading.tsx
│       ├── menubar.tsx
│       ├── multi-file-upload.tsx
│       ├── multi-select.tsx
│       ├── navigation-menu.tsx
│       ├── pagination-ui.tsx
│       ├── popover.tsx
│       ├── progress.tsx
│       ├── radio-group.tsx
│       ├── resizable.tsx
│       ├── scroll-area.tsx
│       ├── search-bar.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx
│       ├── simple-select.tsx
│       ├── skeleton.tsx
│       ├── slider.tsx
│       ├── sonner.tsx
│       ├── spinner.tsx
│       ├── switch.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── task-status.tsx
│       ├── textarea.tsx
│       ├── theme-toggle.tsx
│       ├── toast.tsx
│       ├── toggle-group.tsx
│       ├── toggle.tsx
│       ├── tooltip.tsx
│       ├── typography.tsx
│       └── widget.tsx
├── constants/
│   └── index.ts
├── contexts/
│   ├── auth-context.tsx
│   ├── notification-context.tsx
│   ├── security-permissions-context.tsx
│   └── sidebar-context.tsx
├── entities/
│   ├── agent/
│   │   ├── api/
│   │   │   ├── agent.ts
│   │   │   └── index.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── changelog/
│   │   ├── api/
│   │   │   ├── changelog.ts
│   │   │   └── index.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── dashboard/
│   │   ├── api/
│   │   │   ├── dashboard.ts
│   │   │   └── index.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── file/
│   │   ├── api/
│   │   │   ├── delete.ts
│   │   │   ├── download.ts
│   │   │   ├── file.ts
│   │   │   ├── index.ts
│   │   │   └── upload.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── index.ts
│   ├── key/
│   │   ├── api/
│   │   │   ├── bulk.ts
│   │   │   ├── index.ts
│   │   │   ├── key.ts
│   │   │   └── operations.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── log/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── log.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── navigation/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── navigation.ts
│   │   ├── index.ts
│   │   ├── lib/
│   │   │   └── navigation-access.ts
│   │   └── model/
│   │       └── types.ts
│   ├── notification/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── notification.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── product/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── product.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── project/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── project.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── session/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── session.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── settings/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── settings.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   ├── user/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   ├── invite-codes.ts
│   │   │   ├── profile.ts
│   │   │   └── user.ts
│   │   ├── index.ts
│   │   └── model/
│   │       └── types.ts
│   └── webhook/
│       ├── api/
│       │   ├── index.ts
│       │   └── webhook.ts
│       └── index.ts
├── hooks/
│   ├── __tests__/
│   │   ├── use-login-form.test.tsx
│   │   └── use-permissions.test.tsx
│   ├── auth/
│   │   ├── use-auth-actions.ts
│   │   ├── use-auth-errors.ts
│   │   ├── use-auth-init.ts
│   │   ├── use-auth-redirect.ts
│   │   └── use-auth-state.ts
│   ├── index.ts
│   ├── products/
│   │   ├── index.ts
│   │   ├── product-keys.ts
│   │   ├── use-product-dialogs.ts
│   │   ├── use-product-mutations.ts
│   │   ├── use-product-query.ts
│   │   └── use-product-selection.ts
│   ├── use-agents-query.ts
│   ├── use-api-metrics.ts
│   ├── use-auth.ts
│   ├── use-auto-height.tsx
│   ├── use-clients-query.ts
│   ├── use-colors.ts
│   ├── use-config.ts
│   ├── use-controlled-state.tsx
│   ├── use-copy-to-clipboard.ts
│   ├── use-custom-color.ts
│   ├── use-custom-notifications.ts
│   ├── use-dashboard-stats.ts
│   ├── use-debounce.ts
│   ├── use-edit-user-dialog.ts
│   ├── use-file-manager-logic.ts
│   ├── use-file-manager-query.ts
│   ├── use-file-operations.ts
│   ├── use-invite-code.ts
│   ├── use-is-mac.ts
│   ├── use-key-mutations.ts
│   ├── use-keys-data.ts
│   ├── use-keys-management.ts
│   ├── use-keys-query.ts
│   ├── use-keys-ui.ts
│   ├── use-layout.tsx
│   ├── use-load-status.ts
│   ├── use-login-form.ts
│   ├── use-logs-query.ts
│   ├── use-logs.ts
│   ├── use-management-data.ts
│   ├── use-management-stats.ts
│   ├── use-meta-color.ts
│   ├── use-mobile.ts
│   ├── use-mounted.ts
│   ├── use-multi-file-upload.ts
│   ├── use-mutation-helpers.ts
│   ├── use-mutation-observer.ts
│   ├── use-navigation-query.ts
│   ├── use-owner-dashboard.ts
│   ├── use-page-config.tsx
│   ├── use-paginated-resource.ts
│   ├── use-performance-detection.ts
│   ├── use-permissions.ts
│   ├── use-product-filters.ts
│   ├── use-product-management.ts
│   ├── use-product-permissions.ts
│   ├── use-products-query.ts
│   ├── use-profile-data.ts
│   ├── use-project-expiration.ts
│   ├── use-projects-query.ts
│   ├── use-rbac-api.ts
│   ├── use-rbac-tab.ts
│   ├── use-rbac.ts
│   ├── use-referrals-tab.ts
│   ├── use-referrals.ts
│   ├── use-security-query.ts
│   ├── use-sessions-query.ts
│   ├── use-settings-query.ts
│   ├── use-signup-form.ts
│   ├── use-tasks.ts
│   ├── use-themes-config.ts
│   ├── use-toast.ts
│   ├── use-user-activity-query.ts
│   ├── use-user-activity.ts
│   ├── use-users-query.ts
│   └── useOnClickOutside.ts
├── lib/
│   ├── __tests__/
│   │   ├── rbac-utils.test.ts
│   │   ├── sanitization.test.ts
│   │   └── utils.test.ts
│   ├── api/
│   │   ├── client.ts
│   │   └── security.ts
│   ├── blocks.ts
│   ├── colors.ts
│   ├── config.ts
│   ├── csrf.ts
│   ├── error-handler.ts
│   ├── events.ts
│   ├── fonts.ts
│   ├── get-strict-context.tsx
│   ├── global-notifications.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── use-mutation-with-invalidation.ts
│   │   └── use-paginated-query.ts
│   ├── index.ts
│   ├── key-masking.ts
│   ├── monitoring.ts
│   ├── query-client.ts
│   ├── query-retry-utils.ts
│   ├── rbac-utils.ts
│   ├── remote-control-api.ts
│   ├── request-manager.ts
│   ├── sanitization.ts
│   ├── sentry-config.ts
│   ├── source.ts
│   ├── status-utils.ts
│   ├── themes.ts
│   ├── utils.ts
│   ├── validations/
│   │   ├── changelog.ts
│   │   ├── common.ts
│   │   ├── index.ts
│   │   ├── profile.ts
│   │   └── user.ts
│   └── workers/
│       ├── __tests__/
│       │   └── data-processor-worker.test.ts
│       ├── data-processor-worker.ts
│       ├── data-processor.worker.ts
│       ├── file-parser-worker.ts
│       ├── file-parser.worker.ts
│       ├── index.ts
│       └── README.md
├── providers/
│   └── query-provider.tsx
├── services/
│   └── auth-service.ts
├── shared/
│   ├── api/
│   │   ├── api-error-types.ts
│   │   ├── auth-error-handler.ts
│   │   ├── config.ts
│   │   ├── enhanced-client.ts
│   │   ├── error-handler.ts
│   │   ├── error-schemas.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── constants/
│   │   ├── filters.ts
│   │   ├── index.ts
│   │   ├── roles.ts
│   │   └── ui.ts
│   └── constants.ts
├── stores/
│   ├── agent-dialog-store.ts
│   ├── management-store.ts
│   └── product-dialog-store.ts
├── styles/
│   ├── dark-mode-enhancements.css
│   ├── product-theme.css
│   ├── status-badges.css
│   └── themes.css
├── test/
│   ├── setup.ts
│   └── utils.tsx
├── utils/
│   └── index.ts
├── App.tsx
├── index.css
├── main.tsx
└── vite-env.d.ts
```