// __tests__/toll.test.ts
// Unit tests for toll calculation utilities used across the frontend

interface TollRates {
  [key: string]: number
}

// Mirror backend rates
const TOLL_RATES: TollRates = {
  motorcycle: 0.5,
  car: 1.0,
  lcv: 1.5,
  bus: 2.0,
  truck: 2.75,
  hcm: 3.5,
}

const FUEL_EFFICIENCY: TollRates = {
  motorcycle: 45.0,
  car: 18.0,
  lcv: 14.0,
  bus: 6.0,
  truck: 4.5,
  hcm: 3.5,
}

const FUEL_PRICE = 102.0
const FLAG_THRESHOLD = 400.0

function calcToll(distanceKm: number, vehicleClass: string): number {
  const rate = TOLL_RATES[vehicleClass] ?? 1.0
  return Math.round(distanceKm * rate * 100) / 100
}

function calcFuelCost(distanceKm: number, vehicleClass: string): number {
  const efficiency = FUEL_EFFICIENCY[vehicleClass] ?? 18.0
  return Math.round((distanceKm / efficiency) * FUEL_PRICE * 100) / 100
}

function isFlagged(tollAmount: number): boolean {
  return tollAmount > FLAG_THRESHOLD
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Toll Calculation', () => {
  test('car toll for Mumbai-Pune (148km) is positive', () => {
    const toll = calcToll(148, 'car')
    expect(toll).toBeGreaterThan(0)
    expect(toll).toBe(148.0) // 148 * 1.0
  })

  test('truck toll is higher than car for same distance', () => {
    const carToll = calcToll(148, 'car')
    const truckToll = calcToll(148, 'truck')
    expect(truckToll).toBeGreaterThan(carToll)
  })

  test('motorcycle toll is lowest for same distance', () => {
    const motorbikeToll = calcToll(148, 'motorcycle')
    const carToll = calcToll(148, 'car')
    expect(motorbikeToll).toBeLessThan(carToll)
  })

  test('toll scales linearly with distance', () => {
    const toll100 = calcToll(100, 'car')
    const toll200 = calcToll(200, 'car')
    expect(toll200).toBeCloseTo(toll100 * 2, 2)
  })

  test('zero distance returns zero toll', () => {
    expect(calcToll(0, 'car')).toBe(0)
  })

  test('unknown vehicle class defaults to car rate', () => {
    const unknown = calcToll(100, 'unknown_class')
    const car = calcToll(100, 'car')
    expect(unknown).toBe(car)
  })
})

describe('Fuel Cost Calculation', () => {
  test('fuel cost is positive for valid inputs', () => {
    const cost = calcFuelCost(148, 'car')
    expect(cost).toBeGreaterThan(0)
  })

  test('truck fuel cost is higher than car (less efficient)', () => {
    const carCost = calcFuelCost(148, 'car')
    const truckCost = calcFuelCost(148, 'truck')
    expect(truckCost).toBeGreaterThan(carCost)
  })

  test('motorcycle fuel cost is lowest (most efficient)', () => {
    const bikeCost = calcFuelCost(148, 'motorcycle')
    const carCost = calcFuelCost(148, 'car')
    expect(bikeCost).toBeLessThan(carCost)
  })

  test('fuel cost scales with distance', () => {
    const cost100 = calcFuelCost(100, 'car')
    const cost300 = calcFuelCost(300, 'car')
    expect(cost300).toBeCloseTo(cost100 * 3, 1)
  })
})

describe('Flag Detection', () => {
  test('toll above 400 is flagged', () => {
    expect(isFlagged(450)).toBe(true)
    expect(isFlagged(401)).toBe(true)
  })

  test('toll at or below 400 is not flagged', () => {
    expect(isFlagged(400)).toBe(false)
    expect(isFlagged(399)).toBe(false)
    expect(isFlagged(100)).toBe(false)
  })

  test('long truck trip gets flagged', () => {
    const toll = calcToll(568, 'truck') // Hyderabad-Bangalore
    expect(isFlagged(toll)).toBe(true)
  })

  test('short motorcycle trip is not flagged', () => {
    const toll = calcToll(50, 'motorcycle')
    expect(isFlagged(toll)).toBe(false)
  })
})

describe('INR Formatter', () => {
  test('formats number with rupee symbol', () => {
    expect(formatINR(1234)).toContain('₹')
    expect(formatINR(1234)).toContain('1')
  })

  test('formats zero correctly', () => {
    expect(formatINR(0)).toBe('₹0')
  })

  test('handles large numbers', () => {
    const result = formatINR(100000)
    expect(result).toContain('₹')
  })
})

describe('Vehicle Classes', () => {
  const allClasses = ['motorcycle', 'car', 'lcv', 'bus', 'truck', 'hcm']

  test('all vehicle classes have toll rates', () => {
    allClasses.forEach(cls => {
      expect(TOLL_RATES[cls]).toBeDefined()
      expect(TOLL_RATES[cls]).toBeGreaterThan(0)
    })
  })

  test('all vehicle classes have fuel efficiency', () => {
    allClasses.forEach(cls => {
      expect(FUEL_EFFICIENCY[cls]).toBeDefined()
      expect(FUEL_EFFICIENCY[cls]).toBeGreaterThan(0)
    })
  })

  test('toll rates are in ascending order by vehicle weight', () => {
    expect(TOLL_RATES.motorcycle).toBeLessThan(TOLL_RATES.car)
    expect(TOLL_RATES.car).toBeLessThan(TOLL_RATES.lcv)
    expect(TOLL_RATES.lcv).toBeLessThan(TOLL_RATES.bus)
    expect(TOLL_RATES.bus).toBeLessThan(TOLL_RATES.truck)
    expect(TOLL_RATES.truck).toBeLessThan(TOLL_RATES.hcm)
  })
})
