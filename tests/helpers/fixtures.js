export function collectionFixture() {
    return {
        schemaVersion: 4,
        nextInventoryNumber: 124,
        reservedInventoryNumbers: ['000123'],
        distilleries: [{
                id: 'distillery-a', name: 'Test Distillery'
            }],
        bottlings: [{
                id: 'bottling-a', name: 'Test Blend', distilleryIds: ['distillery-a'],
                whiskyType: 'blended_malt', bottler: 'Example Bottler', abv: 46, ageYears: 5,
                volumeMl: 700, compositionComplete: false,
                bottles: [{
                        id: 'bottle-a', inventoryNumber: '000123', volumeType: 'standard', volumeMl: 700, status: 'closed', photos: [], files: []
                    }],
            }],
    };
}
