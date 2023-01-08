const Pledge = require( "../src/es6pledges.js" );

function fpPledgeDelay( dtm ){
	let timeout;
	return new Pledge(
		( fResolve, fReject ) => {
			timeout = setTimeout(
				() => { fResolve( "finishedPledge" )},
				dtm
			);
		},
		() => {
			clearTimeout(timeout);
		}
	);
}

function fpPledgeDelayWithDelayedCancel( dtm, sCancel ){
	let timeout;
	return new Pledge(
		( fResolve, fReject ) => {
			timeout = setTimeout(
				() => { fResolve( "finishedPledge" )},
				dtm
			);
		},
		( fResolve, fReject, b, x ) => {
			return new Promise(( fOk ) => {
				setTimeout(()=>{
					clearTimeout(timeout);
					fResolve( sCancel + x );
					fOk();
				}, 200 );
			})
		}
	);
}

function fpPromiseDelay( dtm ){
	return new Promise(
		( fResolve, fReject ) => {
			setTimeout(
				() => { fReject( "finishedPromise" )},
				dtm
			);
		}
	);
}

// --------------------------------------------
test( "simple resolve", async () => {
	const p1 = fpPledgeDelay( 10000 );
	p1.resolve("faster");
	const s = await	p1;
	expect( s ).toBe( "faster" );
});

// --------------------------------------------
test( "simple resolve", async () => {
	const p1 = fpPledgeDelay( 10000 );
	p1.reject( "faster" );
	let s;
	try {
		s = await	p1;
	}
	catch( err ){
		s = err;
	}
	expect( s ).toBe( "faster" );
});

// --------------------------------------------
test( "simple then release", async () => {
	const p1 = fpPledgeDelay( 10000 );

	p1.resolve("faster");
	
	const s = await	p1.then( x => "resolved1" + x );
	
	expect( s ).toBe( "resolved1faster" );
});

// --------------------------------------------
test( "simple catch reject", async () => {
	const p1 = fpPledgeDelay( 10000 )
		.catch( x => "first catch runs "+ x );

	p1.reject("faster");

	const p2 = p1.catch( x => "later catch does not run " + x );
	const s = await p2;
	
	expect( s ).toBe( "first catch runs faster" );
});

// --------------------------------------------
test( "then chains all release", async () => {
	const p1 = fpPledgeDelay( 10000 )
		.then( x => "first then, " + x );
	
	p1.resolve("faster");
	
	const s = await	p1.then( x => "second then, " + x );
	
	expect( s ).toBe( "second then, first then, faster" );
});


// --------------------------------------------
test( "simple then/catch reject", async () => {
	const p1 = fpPledgeDelay( 10000 )
		.then( x => "resolved1"+ x )
		.catch( x => "first catch runs "+ x );

	p1.reject("faster");

	const p2 = p1.catch( x => "later catch does not run " + x );
	const s = await p2;
	
	expect( s ).toBe( "first catch runs faster" );
});

// --------------------------------------------
test( "all resolve", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.all([ p1, p2 ])
		.then( x => { return { resolvedBatch : x }})
		.catch( x => { return { rejectedBatch : x }})
	
	pBatch.resolve("faster");
	const s = await	pBatch;

	expect( s ).toStrictEqual({ resolvedBatch : [ "faster" , "faster" ]});
});

// --------------------------------------------
test( "all reject", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.all([ p1, p2 ])
		.then( x => { return { resolvedBatch : x }})
		.catch( x => { return { rejectedBatch : x }})
	
	pBatch.reject("faster");
	const s = await	pBatch.catch( x => x );

	expect( s ).toStrictEqual({ rejectedBatch : "faster" });
});

// --------------------------------------------
test( "any resolve", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.any([ p1, p2 ])
		.then( x => { return { resolvedBatch : x }})
		.catch( x => { return { rejectedBatch : x }})
	
	p1.resolve("faster");

	const s = await	pBatch;

	expect( s ).toStrictEqual({ resolvedBatch : "faster" });

});

// --------------------------------------------
test( "any but all rejected", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.any([ p1, p2 ])
		.then( x => "resolvedBatch:"+ x )
		.catch( x => "rejectedBatch:"+ x );

	p2.reject("faster");
	p1.reject("faster");
	const s = await	pBatch;
	
	expect( s ).toBe( "rejectedBatch:AggregateError: All promises were rejected" );
});

// --------------------------------------------
test( "race resolve", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.race([ p1, p2 ])
		.then( x => { return { resolvedBatch : x }})
		.catch( x => { return { rejectedBatch : x }})
	
	pBatch.resolve("faster");
	const s = await	pBatch;
	
	expect( s ).toStrictEqual({ resolvedBatch : "faster" });
});

// --------------------------------------------
test( "race reject", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.race([ p1, p2 ])
		.then( x => { return { resolvedBatch : x }})
		.catch( x => { return { rejectedBatch : x }})
	
	pBatch.reject("faster");
	const s = await	pBatch;
	
	expect( s ).toStrictEqual({ rejectedBatch : "faster" });
});

// --------------------------------------------
test( "allSettled resolve", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.allSettled([ p1, p2 ]);
	
	pBatch.resolve("faster");
	const x = await	pBatch;
	
	expect( x ).toStrictEqual([
    {
      "status": "released-fulfilled",
      "value": "faster",
    },
    {
      "status": "released-fulfilled",
      "value": "faster",
		}
	]);
});

// --------------------------------------------
test( "allSettled reject", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.allSettled([ p1, p2 ])

	pBatch.reject("faster");
	const x = await	pBatch;
	
	expect( x ).toStrictEqual([
    {
      "status": "released-rejected",
      "reason": "faster",
    },
    {
      "status": "released-rejected",
      "reason": "faster",
		}
	]);
});

// --------------------------------------------
test( "allSettled resolve/reject", async () => {
	const p1 = fpPledgeDelay( 10000 );
	const p2 = fpPledgeDelay( 10000 );
	const pBatch = Pledge.allSettled([ p1, p2 ])

	p1.reject("faster");
	p2.resolve("faster");
	const x = await	pBatch;
	
	expect( x ).toStrictEqual([
    {
      "status": "rejected",
      "reason": "faster",
    },
    {
      "status": "fulfilled",
      "value": "faster",
		}
	]);
});


// --------------------------------------------
test( "delayed cancel resolve", async () => {
	const p1 = fpPledgeDelayWithDelayedCancel( 10000, "delayed" );
	p1.resolve("faster");
	const s = await	p1;
	expect( s ).toBe( "delayedfaster" );
});


/*
const p1 = fpPledgeDelay( 10000 )
	.then( x => { console.log( "resolved1", x ); return x; })
	.catch( x => { console.log("rejected1", x ); return Pledge.reject( x ); });

p1.resolve("ok").then( x => console.log("RESOLVE", x));

const p1 = fpPledgeDelay( 1000 )
	.then( x => { console.log( "resolved1", x ); return x; })
	.catch( x => { console.log("rejected1", x ); return Pledge.reject( x ); });

const p2 = fpPromiseDelay( 2000 )
	.then( x => { console.log( "resolved2", x ); return x; })
	.catch( x => { console.log("rejected2", x ); return Pledge.reject( x ); });

const pAllSettled = Pledge.allSettled([ p1, p2 ])
	.then(( x )=>console.log("allSettled resolved", x))
	.catch(( x )=>console.log("allSettled rejected", x));
pAllSettled.release( true,  "releaseAllSettled" );


const pAny = Pledge.any([ p1, p2 ])
	.then(( x )=>console.log("any resolved", x))
	.catch(( x )=>console.log("any rejected", x));
pAny.release( true,  "releaseAny" );

//p1.resolve( "release1" );
//p2.resolve( "release2" );

*/


