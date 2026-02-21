/**
 * Simple Schema Strategy Test
 * 
 * Basic test to verify the schema strategy components work
 */

describe('Schema Strategy - Basic Tests', () => {
  test('should verify DiscoveryFactory exists', () => {
    // Test that we can import the DiscoveryFactory
    expect(() => {
      const { DiscoveryFactory } = require('../core/factories/discovery-factory.js');
      return DiscoveryFactory;
    }).not.toThrow();
  });

  test('should verify SchemaDiscoveryCoordinator exists', () => {
    // Test that we can import the SchemaDiscoveryCoordinator
    expect(() => {
      const { SchemaDiscoveryCoordinator } = require('../core/coordinators/schema-discovery.coordinator.js');
      return SchemaDiscoveryCoordinator;
    }).not.toThrow();
  });


  test('should verify SQLite coordinator exists', () => {
    // Test that we can import the SQLite coordinator
    expect(() => {
      const { SQLiteDiscoveryCoordinator } = require('../dialects/sqlite/sqlite-discovery.coordinator.js');
      return SQLiteDiscoveryCoordinator;
    }).not.toThrow();
  });

  test('should verify singleton pattern works for DiscoveryFactory', () => {
    const { DiscoveryFactory } = require('../core/factories/discovery-factory.js');
    
    const instance1 = DiscoveryFactory.getInstance();
    const instance2 = DiscoveryFactory.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  test('should verify singleton pattern works for SchemaDiscoveryCoordinator', () => {
    const { SchemaDiscoveryCoordinator } = require('../core/coordinators/schema-discovery.coordinator.js');
    
    const instance1 = SchemaDiscoveryCoordinator.getInstance();
    const instance2 = SchemaDiscoveryCoordinator.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  test('should verify dialect support', () => {
    const { DiscoveryFactory } = require('../core/factories/discovery-factory.js');
    const factory = DiscoveryFactory.getInstance();
    
    expect(factory.isDialectSupported('postgresql')).toBe(true);
    expect(factory.isDialectSupported('sqlite')).toBe(true);
    expect(factory.isDialectSupported('mysql')).toBe(false);
  });

  test('should verify error handling for unsupported dialects', () => {
    const { DiscoveryFactory } = require('../core/factories/discovery-factory.js');
    const factory = DiscoveryFactory.getInstance();
    
    expect(() => {
      factory.createIndexDiscovery('oracle');
    }).toThrow('Unsupported dialect');
  });

  test('should verify PostgreSQL capabilities', () => {
    const { DiscoveryFactory } = require('../core/factories/discovery-factory.js');
    const factory = DiscoveryFactory.getInstance();
    
    const capabilities = factory.getDialectCapabilities('postgresql');
    
    expect(capabilities.supportsViews).toBe(true);
    expect(capabilities.supportsIndexes).toBe(true);
    expect(capabilities.supportsConstraints).toBe(true);
    expect(capabilities.supportsForeignKeys).toBe(true);
    expect(capabilities.supportsCheckConstraints).toBe(true);
    expect(capabilities.supportsDeferredConstraints).toBe(true);
  });

  test('should verify SQLite capabilities', () => {
    const { DiscoveryFactory } = require('../core/factories/discovery-factory.js');
    const factory = DiscoveryFactory.getInstance();
    
    const capabilities = factory.getDialectCapabilities('sqlite');
    
    expect(capabilities.supportsViews).toBe(true);
    expect(capabilities.supportsIndexes).toBe(true);
    expect(capabilities.supportsConstraints).toBe(true);
    expect(capabilities.supportsForeignKeys).toBe(true);
    expect(capabilities.supportsCheckConstraints).toBe(true);
    expect(capabilities.supportsDeferredConstraints).toBe(false);
  });
});
