import {
  ICAOAircraftCategory,
  StandDimensions,
  AircraftCompatibility,
  GroundSupportCapabilities,
  OperationalConstraints,
  EnvironmentalFeatures,
  InfrastructureCapabilities,
} from './stand-capabilities';

describe('Stand Capabilities Types', () => {
  describe('ICAOAircraftCategory', () => {
    it('should have all ICAO categories', () => {
      expect(ICAOAircraftCategory.A).toBe('A');
      expect(ICAOAircraftCategory.B).toBe('B');
      expect(ICAOAircraftCategory.C).toBe('C');
      expect(ICAOAircraftCategory.D).toBe('D');
      expect(ICAOAircraftCategory.E).toBe('E');
      expect(ICAOAircraftCategory.F).toBe('F');
    });
  });

  describe('StandDimensions', () => {
    it('should create valid stand dimensions', () => {
      const dimensions: StandDimensions = {
        length: 50,
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
        clearances: {
          wingtipClearance: 4.5,
          taxilaneClearance: 19.5,
          noseClearance: 10,
          tailClearance: 10,
        },
        maxParkingEnvelope: {
          length: 48,
          width: 43,
        },
        slope: {
          longitudinal: 1.0,
          transverse: 1.5,
        },
      };

      expect(dimensions.length).toBe(50);
      expect(dimensions.width).toBe(45);
      expect(dimensions.icaoCategory).toBe('C');
      expect(dimensions.clearances?.wingtipClearance).toBe(4.5);
      expect(dimensions.slope?.longitudinal).toBe(1.0);
    });
  });

  describe('AircraftCompatibility', () => {
    it('should create valid aircraft compatibility', () => {
      const compatibility: AircraftCompatibility = {
        maxWingspan: 36,
        maxLength: 40,
        maxHeight: 12.5,
        maxWeight: 75000,
        compatibleCategories: [ICAOAircraftCategory.B, ICAOAircraftCategory.C],
        specificAircraft: ['A320', 'B737-800', 'A319'],
        restrictions: ['No A321 due to length constraints'],
      };

      expect(compatibility.maxWingspan).toBe(36);
      expect(compatibility.compatibleCategories).toContain(ICAOAircraftCategory.C);
      expect(compatibility.specificAircraft).toContain('A320');
      expect(compatibility.restrictions).toHaveLength(1);
    });
  });

  describe('GroundSupportCapabilities', () => {
    it('should create valid ground support capabilities', () => {
      const groundSupport: GroundSupportCapabilities = {
        hasPowerSupply: true,
        powerSupplyTypes: ['400Hz', '28VDC'],
        hasGroundPower: true,
        groundPowerCapacity: 90,
        hasPCA: true,
        pcaCapacity: 'Dual-unit system',
        hasWaterSupply: true,
        hasFuelHydrant: true,
        fuelFlowRate: 1200,
        hasGroundSupport: true,
        groundSupportTypes: ['GPU', 'ASU', 'ACU'],
      };

      expect(groundSupport.hasPowerSupply).toBe(true);
      expect(groundSupport.powerSupplyTypes).toContain('400Hz');
      expect(groundSupport.fuelFlowRate).toBe(1200);
      expect(groundSupport.groundSupportTypes).toHaveLength(3);
    });
  });

  describe('OperationalConstraints', () => {
    it('should create valid operational constraints', () => {
      const constraints: OperationalConstraints = {
        pushbackRequired: true,
        pushbackDirection: 'LEFT',
        maxTurnRadius: 45,
        engineStartRestrictions: ['No engine start during 22:00-06:00'],
        timeRestrictions: {
          startTime: '06:00',
          endTime: '22:00',
          daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        },
        simultaneousOperations: {
          allowedWithAdjacent: false,
          restrictions: ['Cannot operate when adjacent stand has Code E aircraft'],
        },
      };

      expect(constraints.pushbackRequired).toBe(true);
      expect(constraints.pushbackDirection).toBe('LEFT');
      expect(constraints.timeRestrictions?.daysOfWeek).toHaveLength(5);
      expect(constraints.simultaneousOperations?.allowedWithAdjacent).toBe(false);
    });
  });

  describe('EnvironmentalFeatures', () => {
    it('should create valid environmental features', () => {
      const environmental: EnvironmentalFeatures = {
        noiseCategory: 'MEDIUM',
        hasBlastFence: true,
        drainage: 'GOOD',
        lighting: {
          standLighting: true,
          leadInLights: true,
          emergencyLighting: true,
        },
        weatherProtection: {
          covered: false,
          partialCover: true,
          windProtection: true,
        },
      };

      expect(environmental.noiseCategory).toBe('MEDIUM');
      expect(environmental.hasBlastFence).toBe(true);
      expect(environmental.lighting?.standLighting).toBe(true);
      expect(environmental.weatherProtection?.covered).toBe(false);
    });
  });

  describe('InfrastructureCapabilities', () => {
    it('should create valid infrastructure capabilities', () => {
      const infrastructure: InfrastructureCapabilities = {
        pavementType: 'CONCRETE',
        pavementCondition: 'EXCELLENT',
        loadBearing: 60, // PCN 60
        hasBridgeConnection: true,
        bridgeTypes: ['UPPER_DECK', 'LOWER_DECK'],
        hasGroundMarkings: true,
        markingCondition: 'GOOD',
        accessibility: {
          vehicleAccess: true,
          serviceRoadConnection: true,
          emergencyAccess: true,
        },
      };

      expect(infrastructure.pavementType).toBe('CONCRETE');
      expect(infrastructure.loadBearing).toBe(60);
      expect(infrastructure.bridgeTypes).toContain('UPPER_DECK');
      expect(infrastructure.accessibility?.vehicleAccess).toBe(true);
    });
  });
});
