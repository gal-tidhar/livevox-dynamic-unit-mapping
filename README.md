# LiveVox Dynamic Unit Mapping Rule Builder

A standalone web UI for building and testing dynamic unit mapping rules for LiveVox integrations.

## Overview

This UI allows business users to configure complex unit mapping rules without code changes. Rules are stored as JSON in AWS AppConfig and evaluated against call/agent metadata to determine the appropriate unit_id.

## Features

### 🔧 Rule Builder
- Visual rule builder with drag-and-drop interface  
- Support for complex conditions with AND/OR logic
- Priority-based rule evaluation
- Multiple condition operators: EQUALS, IN, CONTAINS, REGEX_MATCH, etc.
- Real-time JSON configuration generation

### 📊 Metadata Fields Supported
Based on LiveVox API structure:
- `agent` - Agent ID
- `agent_department` - Agent Department  
- `agent_sub_role` - Agent Sub Role
- `campaign` - Campaign Name
- `campaignType` - Campaign Type (Inbound/Outbound)
- `service` - Service Type
- `queue_name` - Queue Name
- `skill_groups` - Skill Groups (array)
- `team` - Team Name
- `shift` - Shift (Day/Night)
- `language` - Language
- `lvResult` - LiveVox Result (SALE, NO_SALE, etc.)
- `termCode` - Termination Code
- `duration` - Call Duration (seconds)
- `areaCodeState` - Area Code State
- `zipCode` - Zip Code

### 🧪 Testing Sandbox
- Test rules against sample metadata
- Real-time evaluation results
- Detailed rule matching logs
- Example NRA organization metadata included

### 📋 Configuration Management
- JSON output compatible with AWS AppConfig
- Configuration validation
- Copy-to-clipboard functionality
- Version control support

## Usage

1. **Open the UI**: Open `index.html` in a web browser
2. **Review Example Metadata**: Sample LiveVox metadata is pre-loaded
3. **Build Rules**: 
   - Click "Add Rule" to create new rules
   - Configure conditions using the visual builder
   - Set priority and target unit_id
4. **Test Rules**: 
   - Use the sandbox to test rules against metadata
   - View detailed evaluation results
5. **Export Configuration**: 
   - Copy the generated JSON
   - Deploy to AWS AppConfig (manual process)

## Example Configuration

```json
{
  "unit_mapping_rules": {
    "version": "1.0",
    "default_unit_id": "nra-default-unit",
    "rules": [
      {
        "id": "rule-1",
        "name": "Sales Team Rule",
        "priority": 100,
        "conditions": {
          "field": "agent_department",
          "operator": "EQUALS",
          "value": "Sales"
        },
        "result": {
          "unit_id": "nra-sales-unit"
        }
      }
    ]
  }
}
```

## Rule Evaluation Logic

Rules are evaluated in priority order (highest first):
1. **Match Evaluation**: Each rule's conditions are evaluated against metadata
2. **First Match Wins**: The first matching rule's unit_id is returned
3. **Default Fallback**: If no rules match, default_unit_id is used
4. **Condition Logic**: 
   - `AND`: All conditions must match
   - `OR`: Any condition must match

## Supported Operators

- `EQUALS` / `NOT_EQUALS`: Exact string/number comparison
- `IN` / `NOT_IN`: Value in comma-separated list
- `CONTAINS` / `NOT_CONTAINS`: Substring search
- `STARTS_WITH` / `ENDS_WITH`: String prefix/suffix
- `IS_NULL_OR_EMPTY` / `IS_NOT_NULL_OR_EMPTY`: Null/empty checks
- `GREATER_THAN` / `LESS_THAN`: Numeric comparison
- `REGEX_MATCH`: Regular expression matching

## Files

- `index.html` - Main UI structure
- `styles.css` - Styling and responsive design
- `script.js` - Rule engine logic and UI interactions
- `README.md` - This documentation

## Integration with LiveVox

This UI generates configurations for the proposed dynamic rule engine:

1. **AppConfig Storage**: JSON configurations stored per organization
2. **Rule Engine**: Server-side evaluation during call processing
3. **Backward Compatibility**: Falls back to static unit_id if no rules
4. **Performance**: Cached rule evaluation with < 50ms target

## Development Notes

- Pure HTML/CSS/JavaScript - no framework dependencies
- Responsive design for desktop and mobile
- LocalStorage could be added for saving work in progress
- AppConfig integration button is disabled (demo mode)

## Next Steps

1. **Server Integration**: Connect to actual AppConfig API
2. **Authentication**: Add AWS authentication
3. **Rule Templates**: Pre-built rule templates for common scenarios
4. **Audit Trail**: Track configuration changes
5. **Bulk Import**: CSV/JSON import for existing configurations