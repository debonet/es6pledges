module.exports = class Pledge extends Promise {
	// ---------------------------------------------------
	constructor( f, fRelease, ...vx ){
		let fResolve, fReject;
		const aSettled = {};

		super(( fResolveIn, fRejectIn, ...vx ) => {
			fResolve = ( x ) => {
				Object.assign( aSettled, { status: 'fulfilled', value: x });
				fResolveIn( x );
			};
			fReject = ( x ) => {
				Object.assign( aSettled, { status: 'rejected', reason: x });
				fRejectIn( x );
			};
			
			f( fResolve, fReject );
		});

		this.aSettled = aSettled;
		let self = this;

		
		this.release = ( bResolve, xStatus, ...vx ) => {
			if ( aSettled.status ){
				return;
			}

			function fbAutoSettle( bCancel ){
				if ( bCancel ){
					return aSettled.status ? true : false;
				}
			
				if ( !aSettled.status ){
					if ( bResolve ){
						fResolve( xStatus );
					}
					else {
						fReject( xStatus );
					}
				}
				return true;
			}

			if ( fRelease ){
				let xCancel = fRelease( fResolve, fReject, bResolve, xStatus, ...vx );
				if ( xCancel instanceof Promise ){
					return xCancel.then( fbAutoSettle );
				}
				else {
					return Promise.resolve( fbAutoSettle( xCancel ));
				}
			}
			return Promise.resolve( fbAutoSettle( false ));
		}
		
		return this;
	}

	// ---------------------------------------------------
	reject( x, ...vx){
		return this.release( false, x, ...vx );
	}

	// ---------------------------------------------------
	resolve( x, ...vx){
		return this.release( true, x, ...vx );
	}
	fulfill = this.resolve;
	
	// ---------------------------------------------------
	then( ...vx ){
		const p =  super.then( ...vx );
		p.release = this.release;
		p.aSettled = this.aSettled;
		return p;
	}

	// ---------------------------------------------------
	static #ffReleaseGroup( vp ){
		return ( bResolve, x ) => {
			vp.forEach( p => {
				if ( p.release ) {
					p.release( bResolve, x );
				}
			});
		}
	}
	
	// ---------------------------------------------------
	static all( vp, ...vx ){
		const p  = super.all( vp, ...vx );
		p.release = Pledge.#ffReleaseGroup( vp );
		return Pledge.race([ p ]);
	}

	// ---------------------------------------------------
	static any( vp, ...vx ){
		const p  = super.any( vp, ...vx );
		p.release = Pledge.#ffReleaseGroup( vp );
		return Pledge.race([ p ]);
	}
	
	// ---------------------------------------------------
	static allSettled( vp, ...vx ){
		const p  = super.allSettled( vp, ...vx );
		p.release = Pledge.#ffReleaseGroup( vp );

		const pReleaser = new Pledge(
			()=>{},
			( fResolve, fReject, bResolve, x ) => {
				fResolve(	vp.map(( p ) => {
					if ( p.aSettled?.status ){
						return p.aSettled;
					}
					if ( bResolve ){
						return { status: 'released-fulfilled', value: x };
					}

					return { status: 'released-rejected', reason: x }
				}));
			}
		);

		const pRace = super.any([ p, pReleaser ]);
		pRace.release = Pledge.#ffReleaseGroup([ p, pReleaser ]);

		return pRace
	}

	// ---------------------------------------------------
	static race( vpIn, ...vx ){
		const vp = [ ...vpIn, new Pledge(()=>{}) ];
		const p  = super.race( vp, ...vx );
		p.release = Pledge.#ffReleaseGroup( vp );
		return p;
	}
};


