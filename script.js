class RuleEngine {
    constructor() {
        this.rules = [];
        this.defaultUnitId = 'nra-default-unit';
        this.version = '1.0';
        this.ruleCounter = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateJsonOutput();
        this.populateFieldsFromMetadata();
        
        // Add initial example rule
        this.addRule();
        this.populateExampleRule();
    }

    setupEventListeners() {
        // Rule management
        document.getElementById('add-rule-btn').addEventListener('click', () => this.addRule());
        
        // Configuration updates
        document.getElementById('default-unit').addEventListener('input', (e) => {
            this.defaultUnitId = e.target.value;
            this.updateJsonOutput();
        });
        
        document.getElementById('rule-version').addEventListener('input', (e) => {
            this.version = e.target.value;
            this.updateJsonOutput();
        });
        
        // JSON actions
        document.getElementById('copy-json-btn').addEventListener('click', () => this.copyJson());
        document.getElementById('validate-json-btn').addEventListener('click', () => this.validateJson());
        
        // Testing
        document.getElementById('test-rules-btn').addEventListener('click', () => this.testRules());
        document.getElementById('use-example-btn').addEventListener('click', () => {
            this.useExampleMetadata();
            this.populateFieldsFromMetadata(); // Refresh fields when example is loaded
        });
        
        // Dynamic field discovery
        document.getElementById('test-metadata').addEventListener('input', () => {
            this.populateFieldsFromMetadata();
        });
        
        // AppConfig (disabled)
        document.getElementById('update-appconfig-btn').addEventListener('click', () => {
            this.showMessage('deployment-status', 'AppConfig update is disabled in demo mode', 'info');
        });
    }

    populateFieldsFromMetadata() {
        try {
            // Get metadata from either example or test metadata
            let metadataText = document.getElementById('test-metadata').value.trim();
            if (!metadataText) {
                metadataText = document.getElementById('example-metadata').value.trim();
            }
            
            if (!metadataText) {
                return;
            }

            const metadata = JSON.parse(metadataText);
            const fields = this.discoverFields(metadata);
            
            // Update all condition field dropdowns
            this.updateFieldDropdowns(fields);
            
        } catch (error) {
            console.warn('Could not parse metadata for field discovery:', error);
        }
    }

    discoverFields(metadata, prefix = '') {
        const fields = [];
        
        for (const [key, value] of Object.entries(metadata)) {
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            const fieldType = this.getFieldType(value);
            
            fields.push({
                path: fieldPath,
                name: this.formatFieldName(fieldPath),
                type: fieldType,
                example: this.getFieldExample(value)
            });
            
            // For nested objects, recurse (but limit depth to avoid infinite recursion)
            if (fieldType === 'object' && prefix.split('.').length < 3) {
                fields.push(...this.discoverFields(value, fieldPath));
            }
        }
        
        return fields.sort((a, b) => a.name.localeCompare(b.name));
    }

    getFieldType(value) {
        if (value === null || value === undefined) return 'unknown';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'string') {
            // Try to detect special string types
            if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return 'datetime';
            if (value.match(/^\d+$/)) return 'numeric-string';
            return 'string';
        }
        return 'unknown';
    }

    formatFieldName(fieldPath) {
        // For nested paths, just use the last part to keep it concise
        const parts = fieldPath.split('.');
        const lastPart = parts[parts.length - 1];
        
        // Convert camelCase to readable format
        const readable = lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        // If nested, show parent context briefly
        if (parts.length > 1) {
            const parent = parts[parts.length - 2];
            return `${readable} (${parent})`;
        }
        
        return readable;
    }

    getFieldExample(value) {
        if (Array.isArray(value)) {
            return value.length > 0 ? `[${value[0]}${value.length > 1 ? ', ...' : ''}]` : '[]';
        }
        if (typeof value === 'object' && value !== null) {
            return '{...}';
        }
        return String(value);
    }

    updateFieldDropdowns(fields) {
        // Find all condition field dropdowns (including those in templates)
        const dropdowns = document.querySelectorAll('.condition-field');
        
        dropdowns.forEach(dropdown => {
            const currentValue = dropdown.value;
            
            // Clear existing options except the first one
            dropdown.innerHTML = '<option value="">Select field...</option>';
            
            // Add discovered fields
            fields.forEach(field => {
                const option = document.createElement('option');
                option.value = field.path;
                option.textContent = field.name;
                option.title = `${field.type} - Example: ${field.example}`;
                dropdown.appendChild(option);
            });
            
            // Restore previous selection if it still exists
            if (currentValue && fields.find(f => f.path === currentValue)) {
                dropdown.value = currentValue;
            }
        });

        // Update the template as well for future conditions
        this.updateConditionTemplate(fields);
    }

    updateConditionTemplate(fields) {
        const template = document.getElementById('condition-template');
        const templateDropdown = template.content.querySelector('.condition-field');
        
        if (templateDropdown) {
            templateDropdown.innerHTML = '<option value="">Select field...</option>';
            
            fields.forEach(field => {
                const option = document.createElement('option');
                option.value = field.path;
                option.textContent = field.name;
                option.title = `${field.type} - Example: ${field.example}`;
                templateDropdown.appendChild(option);
            });
        }
    }

    addRule() {
        this.ruleCounter++;
        const ruleId = `rule-${this.ruleCounter}`;
        
        const template = document.getElementById('rule-template');
        const ruleElement = template.content.cloneNode(true);
        
        // Set rule ID and number
        ruleElement.querySelector('.rule-item').setAttribute('data-rule-id', ruleId);
        ruleElement.querySelector('.rule-number').textContent = this.ruleCounter;
        
        // Setup event listeners for this rule
        this.setupRuleEventListeners(ruleElement, ruleId);
        
        document.getElementById('rules-list').appendChild(ruleElement);
        
        // Add rule to internal array
        this.rules.push({
            id: ruleId,
            name: `Rule ${this.ruleCounter}`,
            priority: 100 - (this.ruleCounter - 1) * 10,
            unitId: '',
            conditions: [],
            conditionOperator: 'AND'
        });
        
        this.updateJsonOutput();
    }

    setupRuleEventListeners(ruleElement, ruleId) {
        // Delete rule
        ruleElement.querySelector('.delete-rule').addEventListener('click', () => {
            this.deleteRule(ruleId);
        });
        
        // Move rule up/down
        ruleElement.querySelector('.move-up').addEventListener('click', () => {
            this.moveRule(ruleId, -1);
        });
        
        ruleElement.querySelector('.move-down').addEventListener('click', () => {
            this.moveRule(ruleId, 1);
        });
        
        // Rule field updates
        ruleElement.querySelector('.rule-name').addEventListener('input', (e) => {
            this.updateRuleField(ruleId, 'name', e.target.value);
        });
        
        ruleElement.querySelector('.rule-priority').addEventListener('input', (e) => {
            this.updateRuleField(ruleId, 'priority', parseInt(e.target.value));
        });
        
        ruleElement.querySelector('.rule-unit-id').addEventListener('input', (e) => {
            this.updateRuleField(ruleId, 'unitId', e.target.value);
        });
        
        ruleElement.querySelector('.condition-operator').addEventListener('change', (e) => {
            this.updateRuleField(ruleId, 'conditionOperator', e.target.value);
        });
        
        // Add condition button
        ruleElement.querySelector('.add-condition').addEventListener('click', () => {
            this.addCondition(ruleId);
        });
    }

    deleteRule(ruleId) {
        // Remove from DOM
        document.querySelector(`[data-rule-id="${ruleId}"]`).remove();
        
        // Remove from internal array
        this.rules = this.rules.filter(rule => rule.id !== ruleId);
        
        this.updateJsonOutput();
    }

    moveRule(ruleId, direction) {
        const currentIndex = this.rules.findIndex(rule => rule.id === ruleId);
        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.rules.length) {
            // Swap in array
            [this.rules[currentIndex], this.rules[newIndex]] = [this.rules[newIndex], this.rules[currentIndex]];
            
            // Swap in DOM
            const rulesList = document.getElementById('rules-list');
            const currentElement = document.querySelector(`[data-rule-id="${ruleId}"]`);
            const targetElement = direction === -1 ? currentElement.previousElementSibling : currentElement.nextElementSibling;
            
            if (targetElement) {
                if (direction === -1) {
                    rulesList.insertBefore(currentElement, targetElement);
                } else {
                    rulesList.insertBefore(targetElement, currentElement);
                }
            }
            
            this.updateJsonOutput();
        }
    }

    updateRuleField(ruleId, field, value) {
        const rule = this.rules.find(rule => rule.id === ruleId);
        if (rule) {
            rule[field] = value;
            this.updateJsonOutput();
        }
    }

    addCondition(ruleId) {
        const ruleElement = document.querySelector(`[data-rule-id="${ruleId}"]`);
        const conditionsList = ruleElement.querySelector('.conditions-list');
        
        const template = document.getElementById('condition-template');
        const conditionElement = template.content.cloneNode(true);
        
        // Add to rule's conditions BEFORE setting up event listeners
        const rule = this.rules.find(rule => rule.id === ruleId);
        if (rule) {
            const newCondition = {
                field: '',
                operator: 'EQUALS',
                value: ''
            };
            rule.conditions.push(newCondition);
        }
        
        // Setup condition event listeners with correct index
        this.setupConditionEventListeners(conditionElement, ruleId);
        
        conditionsList.appendChild(conditionElement);
        
        // Don't update JSON output until condition is properly configured
        // this.updateJsonOutput();
    }

    setupConditionEventListeners(conditionElement, ruleId) {
        const rule = this.rules.find(rule => rule.id === ruleId);
        const conditionIndex = rule ? rule.conditions.length - 1 : 0;
        
        // Store the condition index on the element for later reference
        const conditionItem = conditionElement.querySelector('.condition-item');
        conditionItem.setAttribute('data-condition-index', conditionIndex);
        
        conditionElement.querySelector('.condition-field').addEventListener('change', (e) => {
            const currentIndex = parseInt(conditionItem.getAttribute('data-condition-index'));
            this.updateCondition(ruleId, currentIndex, 'field', e.target.value);
        });
        
        conditionElement.querySelector('.condition-operator-type').addEventListener('change', (e) => {
            const currentIndex = parseInt(conditionItem.getAttribute('data-condition-index'));
            this.updateCondition(ruleId, currentIndex, 'operator', e.target.value);
        });
        
        conditionElement.querySelector('.condition-value').addEventListener('input', (e) => {
            const currentIndex = parseInt(conditionItem.getAttribute('data-condition-index'));
            this.updateCondition(ruleId, currentIndex, 'value', e.target.value);
        });
        
        conditionElement.querySelector('.remove-condition').addEventListener('click', () => {
            const currentIndex = parseInt(conditionItem.getAttribute('data-condition-index'));
            this.removeCondition(ruleId, currentIndex, conditionItem);
        });
    }

    updateCondition(ruleId, conditionIndex, field, value) {
        const rule = this.rules.find(rule => rule.id === ruleId);
        if (rule && rule.conditions[conditionIndex]) {
            rule.conditions[conditionIndex][field] = value;
            // Always update JSON output when condition changes
            this.updateJsonOutput();
        }
    }

    removeCondition(ruleId, conditionIndex, conditionElement) {
        // Remove from DOM
        conditionElement.remove();
        
        // Remove from rule
        const rule = this.rules.find(rule => rule.id === ruleId);
        if (rule && rule.conditions[conditionIndex]) {
            rule.conditions.splice(conditionIndex, 1);
        }
        
        // Update condition indices for remaining conditions
        const ruleElement = document.querySelector(`[data-rule-id="${ruleId}"]`);
        const remainingConditions = ruleElement.querySelectorAll('.condition-item');
        remainingConditions.forEach((item, index) => {
            item.setAttribute('data-condition-index', index);
        });
        
        this.updateJsonOutput();
    }

    updateJsonOutput() {
        const config = this.generateConfiguration();
        const jsonOutput = document.getElementById('json-output');
        jsonOutput.value = JSON.stringify(config, null, 2);
    }

    generateConfiguration() {
        const rules = this.rules.map(rule => {
            const conditions = this.buildConditions(rule);
            
            return {
                id: rule.id,
                name: rule.name || rule.id,
                priority: rule.priority,
                conditions: conditions,
                result: {
                    unit_id: rule.unitId || this.defaultUnitId
                }
            };
        }).filter(rule => rule.conditions && Object.keys(rule.conditions).length > 0);

        return {
            unit_mapping_rules: {
                version: this.version,
                default_unit_id: this.defaultUnitId,
                rules: rules
            }
        };
    }

    buildConditions(rule) {
        if (rule.conditions.length === 0) {
            return null;
        }

        // Filter out invalid conditions
        const validConditions = rule.conditions
            .map(condition => this.buildSingleCondition(condition))
            .filter(condition => condition !== null);

        if (validConditions.length === 0) {
            return null;
        }

        if (validConditions.length === 1) {
            return validConditions[0];
        }

        return {
            operator: rule.conditionOperator,
            clauses: validConditions
        };
    }

    buildSingleCondition(condition) {
        if (!condition.field || !condition.operator) {
            return null;
        }

        const conditionObj = {
            field: condition.field,
            operator: condition.operator
        };

        // Handle different operator types
        if (['IS_NULL_OR_EMPTY', 'IS_NOT_NULL_OR_EMPTY'].includes(condition.operator)) {
            // These operators don't need values
        } else if (['IN', 'NOT_IN'].includes(condition.operator)) {
            // These operators expect arrays
            conditionObj.values = condition.value ? condition.value.split(',').map(v => v.trim()) : [];
        } else {
            // Single value operators
            conditionObj.value = condition.value;
        }

        return conditionObj;
    }

    copyJson() {
        const jsonOutput = document.getElementById('json-output');
        jsonOutput.select();
        document.execCommand('copy');
        
        this.showMessage('json-output', 'JSON copied to clipboard!', 'success', 2000);
    }

    validateJson() {
        try {
            const jsonText = document.getElementById('json-output').value;
            JSON.parse(jsonText);
            this.showMessage('json-output', 'JSON is valid!', 'success', 2000);
        } catch (error) {
            this.showMessage('json-output', `JSON validation error: ${error.message}`, 'error', 4000);
        }
    }

    testRules() {
        try {
            const testMetadata = document.getElementById('test-metadata').value;
            let metadata;

            if (!testMetadata.trim()) {
                this.showTestResult('Please enter test metadata JSON', 'error');
                return;
            }

            try {
                metadata = JSON.parse(testMetadata);
            } catch (e) {
                this.showTestResult('Invalid JSON in test metadata', 'error');
                return;
            }

            const result = this.evaluateRules(metadata);
            
            let resultText = `Test Results:\n`;
            resultText += `Input Metadata: ${Object.keys(metadata).length} fields\n`;
            resultText += `Matched Rule: ${result.matchedRule || 'None (using default)'}\n`;
            resultText += `Result Unit ID: ${result.unitId}\n`;
            resultText += `Evaluation Details:\n${result.details}`;
            
            this.showTestResult(resultText, 'success');
            
        } catch (error) {
            this.showTestResult(`Test error: ${error.message}`, 'error');
        }
    }

    evaluateRules(metadata) {
        let details = '';
        
        // Sort rules by priority (higher first)
        const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
        
        for (const rule of sortedRules) {
            details += `\\nEvaluating Rule: ${rule.name} (Priority: ${rule.priority})\\n`;
            
            if (!rule.unitId) {
                details += `  Skipped - No unit ID configured\\n`;
                continue;
            }
            
            if (rule.conditions.length === 0) {
                details += `  Skipped - No conditions configured\\n`;
                continue;
            }
            
            const ruleMatches = this.evaluateRuleConditions(rule, metadata);
            details += `  Result: ${ruleMatches ? 'MATCH' : 'NO MATCH'}\\n`;
            
            if (ruleMatches) {
                return {
                    unitId: rule.unitId,
                    matchedRule: rule.name,
                    details: details
                };
            }
        }
        
        details += `\\nNo rules matched - using default unit ID\\n`;
        
        return {
            unitId: this.defaultUnitId,
            matchedRule: null,
            details: details
        };
    }

    evaluateRuleConditions(rule, metadata) {
        if (rule.conditions.length === 0) {
            return false;
        }

        // Filter out empty conditions before evaluation
        const validConditions = rule.conditions.filter(condition => 
            condition.field && condition.field.trim() && condition.operator
        );

        if (validConditions.length === 0) {
            return false;
        }

        const results = validConditions.map(condition => this.evaluateSingleCondition(condition, metadata));
        
        if (rule.conditionOperator === 'OR') {
            return results.some(result => result);
        } else {
            return results.every(result => result);
        }
    }

    evaluateSingleCondition(condition, metadata) {
        if (!condition.field || !condition.operator) {
            return false;
        }

        const fieldValue = metadata[condition.field];
        
        switch (condition.operator) {
            case 'EQUALS':
                return fieldValue == condition.value;
            
            case 'NOT_EQUALS':
                return fieldValue != condition.value;
            
            case 'IN':
                const inValues = condition.value ? condition.value.split(',').map(v => v.trim()) : [];
                return inValues.includes(String(fieldValue));
            
            case 'NOT_IN':
                const notInValues = condition.value ? condition.value.split(',').map(v => v.trim()) : [];
                return !notInValues.includes(String(fieldValue));
            
            case 'CONTAINS':
                return String(fieldValue).includes(condition.value);
            
            case 'NOT_CONTAINS':
                return !String(fieldValue).includes(condition.value);
            
            case 'STARTS_WITH':
                return String(fieldValue).startsWith(condition.value);
            
            case 'ENDS_WITH':
                return String(fieldValue).endsWith(condition.value);
            
            case 'IS_NULL_OR_EMPTY':
                return !fieldValue || fieldValue === '';
            
            case 'IS_NOT_NULL_OR_EMPTY':
                return fieldValue && fieldValue !== '';
            
            case 'GREATER_THAN':
                return Number(fieldValue) > Number(condition.value);
            
            case 'LESS_THAN':
                return Number(fieldValue) < Number(condition.value);
            
            case 'REGEX_MATCH':
                try {
                    const regex = new RegExp(condition.value);
                    return regex.test(String(fieldValue));
                } catch (e) {
                    return false;
                }
            
            default:
                return false;
        }
    }

    useExampleMetadata() {
        const exampleMetadata = document.getElementById('example-metadata').value;
        document.getElementById('test-metadata').value = exampleMetadata;
        
        this.showMessage('test-metadata', 'Example metadata loaded!', 'success', 2000);
    }

    showTestResult(message, type) {
        const testOutput = document.getElementById('test-output');
        testOutput.textContent = message;
        testOutput.className = type === 'success' ? 'test-success' : 'test-error';
    }

    showMessage(targetElementId, message, type = 'info', duration = 3000) {
        // Create temporary message overlay
        const targetElement = document.getElementById(targetElementId);
        const rect = targetElement.getBoundingClientRect();
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: ${rect.top - 40}px;
            left: ${rect.left}px;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
            animation: fadeIn 0.3s ease-out;
        `;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => messageDiv.remove(), 300);
        }, duration);
    }

    populateExampleRule() {
        // Wait for DOM to be ready
        setTimeout(() => {
            const firstRule = this.rules[0];
            if (firstRule) {
                // Update rule details
                this.updateRuleField(firstRule.id, 'name', 'Sales Team Rule');
                this.updateRuleField(firstRule.id, 'priority', 100);
                this.updateRuleField(firstRule.id, 'unitId', 'nra-sales-unit');
                
                // Update DOM elements
                const ruleElement = document.querySelector(`[data-rule-id="${firstRule.id}"]`);
                if (ruleElement) {
                    ruleElement.querySelector('.rule-name').value = 'Sales Team Rule';
                    ruleElement.querySelector('.rule-priority').value = 100;
                    ruleElement.querySelector('.rule-unit-id').value = 'nra-sales-unit';
                    
                    // Add example condition
                    this.addCondition(firstRule.id);
                    
                    // Wait for condition to be added, then populate it
                    setTimeout(() => {
                        const conditionElement = ruleElement.querySelector('.condition-item');
                        if (conditionElement) {
                            const fieldSelect = conditionElement.querySelector('.condition-field');
                            const operatorSelect = conditionElement.querySelector('.condition-operator-type');
                            const valueInput = conditionElement.querySelector('.condition-value');
                            
                            fieldSelect.value = 'agent_department';
                            operatorSelect.value = 'EQUALS';
                            valueInput.value = 'Sales';
                            
                            // Trigger events to sync internal state
                            fieldSelect.dispatchEvent(new Event('change'));
                            operatorSelect.dispatchEvent(new Event('change'));
                            valueInput.dispatchEvent(new Event('input'));
                            
                            // Also update the condition data directly to ensure sync
                            this.updateCondition(firstRule.id, 0, 'field', 'agent_department');
                            this.updateCondition(firstRule.id, 0, 'operator', 'EQUALS');
                            this.updateCondition(firstRule.id, 0, 'value', 'Sales');
                        }
                    }, 100);
                }
            }
        }, 100);
    }
}

// Add fade animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
`;
document.head.appendChild(style);

// Initialize the rule engine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.ruleEngine = new RuleEngine();
});