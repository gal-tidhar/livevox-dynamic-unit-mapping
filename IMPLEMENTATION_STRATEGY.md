# LiveVox Dynamic Unit Mapping - Implementation Strategy
## Phase 2.5 REST Gateway Integration

### Executive Summary

This document outlines the implementation strategy for dynamic unit mapping in the LiveVox integration, moving from hardcoded unit IDs to a flexible, rule-based system that enables zero-code organization onboarding.

## Problem Statement

### Current Limitations
- **Hardcoded Unit IDs**: Each organization requires code changes for unit mapping
- **Naive Approach**: Single unit per organization doesn't reflect business complexity
- **Scalability Issues**: Adding new organizations requires developer intervention
- **Business Complexity**: eToro integrations show complex multi-unit logic that needs generalization

### Business Requirements
- **Zero-code onboarding**: Add organizations without code deployment
- **Multi-unit support**: Organizations have multiple units (teams, languages, departments)
- **Dynamic rule evaluation**: Map based on call/agent metadata in real-time
- **UI-configurable**: Business users should configure rules without technical expertise

## Architecture Overview

### Current State Analysis

**eToro Integration Pattern** (Complex):
```python
def get_root_unit_id(agent_sub_role, agent_department):
    # CS Unit: Multiple conditions with priority
    if agent_sub_role in CS_SUB_ROLES:
        return CS_UNIT
    if agent_sub_role == "FCMU" and agent_department == "CS":
        return CS_UNIT
    if agent_sub_role == "Retention":
        return RETENTION_UNIT
    # ... complex fallback logic
    return OPS_UNIT
```

**LiveVox Integration** (Naive):
```python
# Static unit_id from AppConfig
unit_id = org_config.unit_id  # Single hardcoded value
```

### Proposed Solution Architecture

#### 1. Rule Engine Core (`shared/unit_mapping_engine/`)

**JSON-Based Rule Definition**:
```json
{
  "unit_mapping_rules": {
    "version": "1.0",
    "default_unit_id": "org-default-unit",
    "rules": [
      {
        "id": "rule-premium-sales",
        "name": "Premium Sales Team",
        "priority": 100,
        "conditions": {
          "operator": "AND",
          "clauses": [
            {"field": "agent_department", "operator": "EQUALS", "value": "Sales"},
            {"field": "duration", "operator": "GREATER_THAN", "value": "240"}
          ]
        },
        "result": {"unit_id": "org-premium-sales"}
      }
    ]
  }
}
```

**Supported Operators**:
- **Comparison**: `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`
- **String**: `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX_MATCH`
- **List**: `IN`, `NOT_IN`
- **Null**: `IS_NULL_OR_EMPTY`, `IS_NOT_NULL_OR_EMPTY`
- **Logic**: `AND`, `OR` for combining conditions

#### 2. Dynamic Field Discovery

**Metadata-Driven Configuration**:
- Analyzes sample LiveVox payloads to discover available fields
- Automatically populates UI dropdowns with field options
- Supports nested objects and type detection
- Real-time field discovery as metadata changes

**Field Type Detection**:
```javascript
getFieldType(value) {
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if (Array.isArray(value)) return 'array';
    if (value.match(/^\d{4}-\d{2}-\d{2}T/)) return 'datetime';
    return 'string';
}
```

#### 3. Enhanced Organization Service

**Backward Compatible Integration**:
```python
class OrganizationService:
    def get_unit_id_for_context(self, organization_id: str, context: dict) -> str:
        org_config = self.get_organization_config(organization_id)
        
        # Phase 1: New rule-based approach
        if org_config.unit_mapping_rules:
            return self.rule_engine.evaluate_rules(org_config.unit_mapping_rules, context)
        
        # Phase 2: Existing static approach (backward compatibility)
        if org_config.unit_id:
            return org_config.unit_id
        
        # Phase 3: Fallback
        return f"{organization_id}-default"
```

## Implementation Components

### 1. Rule Engine Implementation

**Core Evaluation Logic**:
```python
class RuleEngine:
    def evaluate_rules(self, rules: UnitMappingRules, context: dict) -> str:
        # Sort by priority (highest first)
        sorted_rules = sorted(rules.rules, key=lambda r: r.priority, reverse=True)
        
        for rule in sorted_rules:
            if self.evaluate_rule_conditions(rule, context):
                return rule.result.unit_id
        
        return rules.default_unit_id
    
    def evaluate_rule_conditions(self, rule: Rule, context: dict) -> bool:
        valid_conditions = [c for c in rule.conditions if c.field and c.operator]
        
        if rule.logic_operator == 'OR':
            return any(self.evaluate_condition(c, context) for c in valid_conditions)
        else:  # AND
            return all(self.evaluate_condition(c, context) for c in valid_conditions)
```

### 2. AppConfig Integration

**Configuration Storage Structure**:
```yaml
# Organization AppConfig Profile
clientName: ACME_CORP
env: na6
userName: Sedric_AcmeCorp
password: encrypted_password
access_token: encrypted_token

# Dynamic Unit Mapping Rules
unit_mapping_rules:
  version: "1.0"
  default_unit_id: "acme-corp-default"
  rules:
    - id: "sales-team-rule"
      name: "Sales Team Mapping"
      priority: 100
      conditions:
        field: "agent_department"
        operator: "EQUALS"
        value: "Sales"
      result:
        unit_id: "acme-corp-sales"
    
    - id: "retention-campaign-rule"
      name: "Retention Campaign"
      priority: 90
      conditions:
        field: "campaign"
        operator: "CONTAINS"
        value: "Retention"
      result:
        unit_id: "acme-corp-retention"

# Backward compatibility
unit_id: "acme-corp-legacy-unit"  # Still supported
```

### 3. UI Management Interface

**Business User Tools**:
- **Visual Rule Builder**: Drag-and-drop interface for creating conditions
- **Dynamic Field Discovery**: Automatically populates field options from metadata
- **Real-time Testing**: Sandbox for testing rules against sample data
- **Configuration Management**: Version control, validation, deployment

**Key UI Features**:
- Dynamic dropdown population from metadata analysis
- Priority-based rule ordering with drag-and-drop
- Complex condition builder (AND/OR logic)
- Real-time rule evaluation and testing
- JSON export for AppConfig deployment

## Integration Points

### 1. LiveVox Pipeline Modification

**Before (Static)**:
```python
def _transform_call(organization_id: str, unit_id: str, recording: Recording):
    return Interaction(organization_id=organization_id, unit_id=unit_id, ...)
```

**After (Dynamic)**:
```python
def _transform_call(organization_id: str, recording: Recording, org_service: OrganizationService):
    # Build context from call/agent metadata
    context = {
        "agent_sub_role": recording.agent_metadata.get("sub_role"),
        "agent_department": recording.agent_metadata.get("department"),
        "campaign": recording.campaign,
        "duration": recording.duration,
        "lvResult": recording.lv_result,
        # ... other metadata fields
    }
    
    # Get unit_id dynamically based on rules
    unit_id = org_service.get_unit_id_for_context(organization_id, context)
    
    return Interaction(organization_id=organization_id, unit_id=unit_id, ...)
```

### 2. DynamoDB Units Table Integration

**Enhanced Unit Management**:
```python
# Units table continues to store API keys per unit
{
    "type": "UNIT",
    "organization_id": "acme-corp",
    "id": "acme-corp-sales",           # Result from rule evaluation
    "api_key": "SALES_TEAM_API_KEY"
}
```

## Phase 2.5 REST Gateway Integration

### REST API Endpoints

**Rule Management API**:
```yaml
# Get organization rules
GET /api/v1/organizations/{org_id}/unit-mapping-rules

# Update organization rules
PUT /api/v1/organizations/{org_id}/unit-mapping-rules
Body: {unit_mapping_rules: {...}}

# Test rule evaluation
POST /api/v1/organizations/{org_id}/unit-mapping-rules/test
Body: {metadata: {...}, rules: {...}}
```

**Dynamic Field Discovery API**:
```yaml
# Discover fields from metadata
POST /api/v1/metadata/discover-fields
Body: {metadata: {...}}
Response: {fields: [{path: "agentId", type: "integer", example: "123"}]}
```

### Gateway Integration Points

**Configuration Service**:
- Manages rule storage and retrieval from AppConfig
- Provides rule validation and testing endpoints
- Handles version control and rollback capabilities

**Evaluation Service**:
- Real-time rule evaluation during call processing
- Caches compiled rules for performance
- Provides detailed evaluation logging

## Migration Strategy

### Phase 1: Core Implementation
1. **Rule Engine Development**: Build shared library with comprehensive tests
2. **AppConfig Schema Extension**: Support both static and dynamic configurations
3. **LiveVox Integration**: Modify pipeline to use dynamic unit resolution
4. **Backward Compatibility**: Ensure existing integrations continue working

### Phase 2: UI Development
1. **Management Interface**: Build web UI for rule configuration
2. **Dynamic Field Discovery**: Implement metadata-driven field population
3. **Testing Framework**: Add sandbox for rule evaluation testing
4. **Deployment Tools**: Create AppConfig integration workflows

### Phase 3: Organization Migration
1. **Gradual Rollout**: Migrate organizations one by one
2. **A/B Testing**: Compare static vs. dynamic approaches
3. **Performance Monitoring**: Track rule evaluation performance
4. **User Training**: Enable business teams to use the UI

### Phase 4: Advanced Features
1. **Rule Templates**: Pre-built rule sets for common scenarios
2. **Analytics Dashboard**: Track rule usage and performance
3. **Bulk Operations**: Manage multiple organizations efficiently
4. **Advanced Operators**: Custom functions and complex logic

## Benefits Analysis

### Technical Benefits
- **Scalability**: Add unlimited organizations without code changes
- **Maintainability**: Centralized rule logic vs. scattered hardcoded values
- **Testability**: Rule evaluation can be unit tested independently
- **Performance**: Cached rule evaluation with <50ms target latency

### Business Benefits
- **Reduced Time-to-Market**: New organizations onboarded in hours vs. weeks
- **Business User Empowerment**: Non-technical users can configure routing logic
- **Operational Flexibility**: Rules can be updated without deployments
- **Cost Reduction**: Eliminates developer overhead for organization onboarding

### Risk Mitigation
- **Backward Compatibility**: Existing integrations continue working
- **Gradual Migration**: Low-risk rollout with rollback capabilities
- **Comprehensive Testing**: Sandbox environment for rule validation
- **Monitoring**: Detailed logging and performance tracking

## Success Metrics

### Performance Targets
- **Rule Evaluation**: <50ms for complex rule sets
- **Organization Onboarding**: <2 hours end-to-end
- **UI Response Time**: <500ms for rule configuration changes
- **System Availability**: 99.9% uptime for rule evaluation

### Business Metrics
- **Developer Time Savings**: 80% reduction in organization onboarding effort
- **Configuration Accuracy**: 95% reduction in unit mapping errors
- **User Adoption**: 90% of new organizations use dynamic rules within 6 months
- **Support Ticket Reduction**: 70% fewer unit mapping related issues

## Technical Specifications

### System Requirements
- **Python 3.9+**: Core rule engine implementation
- **JavaScript ES6+**: UI components and field discovery
- **AWS AppConfig**: Rule storage and configuration management
- **DynamoDB**: Unit API key storage
- **React/Vue.js**: Management UI framework (TBD)

### Security Considerations
- **Input Validation**: All rule conditions validated against schema
- **Access Control**: Role-based permissions for rule configuration
- **Audit Trail**: All rule changes logged with user attribution
- **Encryption**: Sensitive configuration data encrypted at rest

### Monitoring and Observability
- **Rule Evaluation Metrics**: Latency, success rate, cache hit ratio
- **Configuration Change Tracking**: Version history and rollback capabilities
- **Error Monitoring**: Failed rule evaluations with context
- **Performance Dashboards**: Real-time system health monitoring

## Conclusion

The dynamic unit mapping solution provides a robust, scalable foundation for multi-organization LiveVox integrations. By moving from hardcoded unit IDs to a flexible rule engine, we enable:

1. **Zero-code organization onboarding**
2. **Business user empowerment**
3. **Complex routing logic without development overhead**
4. **Seamless scalability for enterprise deployments**

The Phase 2.5 REST Gateway integration positions this solution as a core capability for the Sedric platform, enabling rapid expansion into new markets and customer segments while maintaining operational excellence.

---

**Document Version**: 1.0  
**Last Updated**: 2025-08-28  
**Authors**: Claude Code AI Assistant  
**Review Status**: Ready for Implementation Planning