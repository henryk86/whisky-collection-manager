import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCollection } from '../../public/js/domain/analytics.js';
import { normalizeTastingRecord, latestTasting, sortedTastings, displayedTastingRating } from '../../shared/tasting-records.js';
const tasting=(id,tastedOn,rating,createdAt='2026-11-01T08:00:00.000Z')=>({id,tastedOn,rating,title:'',flavorProfile:null,tastingNotes:{nose:'',palate:'',finish:''},whiskyColor:null,createdAt,updatedAt:createdAt});
test('0-n tastings are chronologically sorted; a scoreless latest tasting does not reveal older scores',()=>{
    const b={tastings:[tasting('old','2026-01-01',80),tasting('latest','2026-10-01',null),tasting('middle','2026-05-01',92)]};
    assert.equal(latestTasting(b).id,'latest');
    assert.deepEqual(sortedTastings(b).map(t=>t.id),['latest','middle','old']);
    assert.equal(displayedTastingRating(b),null);
    assert.equal(b.rating,undefined);
    b.tastings.splice(1);
    assert.equal(latestTasting(b).rating,80);
    b.tastings=[];
    assert.equal(b.rating,undefined);
    assert.equal(displayedTastingRating(b),null);
});
test('same-day tastings sort by creation timestamp and then id, independent of update timestamp',()=>{
    const b={tastings:[tasting('a','2026-11-15',10),tasting('b','2026-11-15',20),tasting('c','2026-11-15',30,'2026-11-15T12:00:00Z')]};
    b.tastings[0].updatedAt='2026-12-31T00:00:00.000Z';
    assert.deepEqual(sortedTastings(b).map(x=>x.id),['c','b','a']);
});
test('tasting metadata and rating are validated and foreign fields rejected',()=>{
    const good=normalizeTastingRecord({tastedOn:'2026-11-15',rating:87.5});
    assert.equal(good.rating,87.5);
    assert.equal(good.title,'');
    for (const date of ['2026-02-30','today','2026-13-01',''])
        assert.throws(()=>normalizeTastingRecord({tastedOn:date}));
    for (const rating of [-1,101,'87',NaN])
        assert.throws(()=>normalizeTastingRecord({tastedOn:'2026-11-15',rating}));
    assert.throws(()=>normalizeTastingRecord({tastedOn:'2026-11-15',id:'injected'}));
    assert.throws(()=>normalizeTastingRecord({tastedOn:'2026-11-15',title:'a'.repeat(121)}));
});

test('analytics counts only the latest tasting per bottling and never an older rated record',()=>{
    const b={id:'release-1',name:'Example',distilleryIds:[],bottles:[],tastings:[
        tasting('one','2026-01-01',95),tasting('two','2026-10-01',null)
    ]};
    const collection={distilleries:[],bottlings:[b]};
    let report=analyzeCollection(collection);
    assert.equal(report.tasting.rating.count,0);
    assert.equal(report.quality.missingPurchase.find(x=>x.name==='Bewertung').count,1);
    b.tastings[1].rating=81;
    report=analyzeCollection(collection);
    assert.equal(report.tasting.rating.count,1);
    assert.equal(report.tasting.rating.avg,81);
    assert.equal(report.tasting.bestRated[0].rating,81);
    assert.deepEqual(report.tasting.histogram,[{name:'80–89',count:1}]);
    assert.equal(report.quality.missingPurchase.find(x=>x.name==='Bewertung').count,0);
});
