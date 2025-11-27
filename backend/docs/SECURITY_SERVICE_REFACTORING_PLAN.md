# SecurityService Refactoring Plan

## Текущее состояние

**SecurityService** (1179 строк) - "God Object" с множественной ответственностью:

### Текущие ответственности:
1. **Threat Assessment**: assess_threat, _is_suspicious_user_agent, _is_known_bad_ip, _is_rapid_request, _is_geographic_anomaly, _is_fingerprint_reuse, _generate_recommendations
2. **Security Rules**: check_automated_rules, _evaluate_rule, _execute_rule_action, _evaluate_*_conditions (fingerprint, rate_limit, geo, behavioral, threat_score, vpn, failed_login, hwid_block, brute_force), _update_rule_trigger
3. **Blocking**: create_enhanced_block, is_ip_blocked, _check_and_block_ip_if_needed
4. **Monitoring & Analytics**: get_security_analytics, _log_security_event, record_login_attempt
5. **Session Management**: check_session_limit

## План рефакторинга

### 1. SecurityRulesService
**Ответственность**: Управление и оценка правил безопасности
- `check_automated_rules()` - проверка автоматических правил
- `_evaluate_rule()` - оценка правила
- `_execute_rule_action()` - выполнение действия правила
- `_evaluate_*_conditions()` - все методы оценки условий (fingerprint, rate_limit, geo, behavioral, threat_score, vpn, failed_login, hwid_block, brute_force)
- `_update_rule_trigger()` - обновление триггера правила

### 2. SecurityMonitoringService
**Ответственность**: Мониторинг, аналитика и логирование
- `assess_threat()` - оценка уровня угрозы
- `get_security_analytics()` - получение аналитики безопасности
- `_log_security_event()` - логирование событий безопасности
- `record_login_attempt()` - запись попыток входа
- `_is_suspicious_user_agent()`, `_is_known_bad_ip()`, `_is_rapid_request()`, `_is_geographic_anomaly()`, `_is_fingerprint_reuse()` - детекторы угроз
- `_generate_recommendations()` - генерация рекомендаций

### 3. SecurityAuditService
**Ответственность**: Блокировки, проверки доступа и аудит
- `create_enhanced_block()` - создание блокировки
- `is_ip_blocked()` - проверка блокировки IP
- `check_session_limit()` - проверка лимита сессий
- `_check_and_block_ip_if_needed()` - проверка и блокировка IP при необходимости
- `_get_or_create_project_settings()` - получение настроек проекта

### 4. SecurityService (Facade)
**Ответственность**: Фасад для обратной совместимости
- Делегирует вызовы специализированным сервисам
- Сохраняет публичный API

## Преимущества

1. **Single Responsibility**: Каждый сервис отвечает за одну область
2. **Тестируемость**: Легче тестировать отдельные компоненты
3. **Поддерживаемость**: Изменения в одной области не влияют на другие
4. **Масштабируемость**: Легче добавлять новую функциональность

## Порядок выполнения

1. ✅ Создать SecurityRulesService
2. ✅ Создать SecurityMonitoringService
3. ✅ Создать SecurityAuditService
4. ✅ Обновить SecurityService как фасад
5. ✅ Обновить все места использования
6. ✅ Тестирование

## Обратная совместимость

SecurityService останется как фасад, поэтому все существующие вызовы продолжат работать без изменений.

