"use strict";

module.exports = ( classPromise ) => {
	const Releasable = class extends classPromise {
		#aSettled;
		#fOnRelease;
		#fDoRelease;

		// ---------------------------------------------------
		constructor( f, fOnRelease ){
			let fResolve, fReject;
			const aSettled = {};

			super(( fResolveIn, fRejectIn, ...vx ) => {
				const ffHandle = ( sStatus, fIn ) => {
					return ( xIn ) => {
						if (! aSettled.status ){
							aSettled.status = sStatus;
							aSettled.valueIn = xIn;
							const xOut = fIn( xIn );
							
							const pxIn = ( xIn instanceof Promise ) ? xIn : Promise.resolve( xIn );
							const pxOut = ( xOut instanceof Promise ) ? xOut : Promise.resolve( xOut );

							Promise.all([ pxIn, pxOut ]).then(() => aSettled.bFinished = true );

							return xOut;
						}
					}
				}
				
				fResolve = ffHandle( "resolved", fResolveIn );
				fReject = ffHandle( "rejected", fRejectIn );

				f( fResolve, fReject, ...vx );
			});

			this.#aSettled = aSettled;
			this.#fOnRelease = fOnRelease;

			// set up the fDoRelease function that handles the releasing
			// machinery
			this.#fDoRelease = ( bResolve, xStatus, ...vx ) => {
				if ( this.#aSettled.status ){
					return true;
				}

				if ( this.#aSettled.pSub ){
					this.this.#aSettled.pSub.release( bResolve, xStatus, ...vx );
				}
				
				const fbAutoSettle = ( bCancel ) => {
					if ( bCancel ){
						return this.#aSettled.status ? true : false;
					}
					if ( !this.#aSettled.status ){
						if ( bResolve ){
							fResolve( xStatus );
						}
						else {
							fReject( xStatus );
						}
					}
					return true;
				}

				if ( this.#fOnRelease ){
					let xCancel = this.#fOnRelease(
						fResolve, fReject, bResolve, xStatus, ...vx
					);

					if ( xCancel instanceof Promise ){
						return xCancel.then( fbAutoSettle );
					}
					else {
						return Promise.resolve( fbAutoSettle( xCancel ));
					}
				}
				return Promise.resolve( fbAutoSettle( false ));
			};

			// map the release() to DoRelease but allow it to be overwritten
			// by .then() which needs to handle chaining
			Object.defineProperty( this, 'release', {
				writable: true,
				value : ( ...vx ) => {
					return this.#fDoRelease( ...vx );
				}
			});
		}
			
		// ---------------------------------------------------
		reject( x, ...vx){
			return this.release( false, x, ...vx );
		}

		// ---------------------------------------------------
		resolve( x, ...vx){
			return this.release( true, x, ...vx );
		}
		fulfill( x, ...vx){
			return this.release( true, x, ...vx );
		}
		
		// ---------------------------------------------------
		then( fThen, fCatch ){
			let vxReleaseArgs = [];

			const ffWrap = ( f ) => {
				return ( ...vx ) => {
					const pSub = f( ...vx );

					if ( pSub instanceof Releasable ){
						if ( this.#aSettled.bReleased ){
							pSub.release( ...vxReleaseArgs );
						}
						else{
							p.#aSettled.pSub = pSub;
						}
					}
					return pSub;
				}
			}
			
			const p = super.then(
				fThen ? ffWrap( fThen ) : undefined,
				fCatch ? ffWrap( fCatch ) : undefined
			);

			Object.defineProperty( p, 'release', {
				writable: true,
				value : async ( ...vxReleaseArgsIn ) => {
					// if parent was already released
					if ( this.#aSettled.bFinished ){
						if ( p.#aSettled.pSub ){
							p.#aSettled.pSub.#fDoRelease( ...vxReleaseArgsIn );
						}
						p.#fDoRelease( ...vxReleaseArgsIn );

						return true;
					}
					
					// try releasing parent, then allow child to be released
					else{	
						vxReleaseArgs = vxReleaseArgsIn;
						// if any child is resolved while the parent is being released
						// assume it is because of the release
						this.#aSettled.bReleased = true;
						// tell the parent to release
						const bDoRelease = await this.release( ...vxReleaseArgsIn );
						// if the children did not get resolved during the parents release
						// then they should release only if the parent says its ok
						this.#aSettled.bReleased = bDoRelease;
						return bDoRelease;
					}
				}
			});
			
			return p;
		}

		// ---------------------------------------------------
		static #ffReleaseGroup( vpGroup ){
			return ( ...vx ) => {
				let bAllReleased = true;
				vpGroup.forEach( pGroup => {
					if ( pGroup.release ) {
						bAllReleased = pGroup.release( ...vx ) && bAllReleased;
					}
				});

				return bAllReleased;
			}
		}
		
		// ---------------------------------------------------
		static all( vp, ...vx ){
			const p  = super.all( vp, ...vx );
			p.release = Releasable.#ffReleaseGroup( vp );
			return p;
		}

		// ---------------------------------------------------
		static any( vp, ...vx ){
			const p  = super.any( vp, ...vx );
			p.release = Releasable.#ffReleaseGroup( vp );
			return p;
		}
		
		// ---------------------------------------------------
		static allSettled( vp, ...vx ){
			const p  = super.allSettled( vp, ...vx );

			p.release = Releasable.#ffReleaseGroup( vp );

			const pReleaser = new Releasable(
				() => {},
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
			pRace.release = Releasable.#ffReleaseGroup([ p, pReleaser ]);

			return pRace
		}

		// ---------------------------------------------------
		static race( vpIn, ...vx ){
			const vp = [ ...vpIn, new Releasable(()=>{}) ];
			const p  = super.race( vp, ...vx );
			p.release = Releasable.#ffReleaseGroup( vp );
			return p;
		}


		// ---------------------------------------------------
		static detachable( p ){
			return new Releasable( ( fOk, fErr ) =>{
				p.then( fOk, fErr );
			});
		}
		
	};

	return Releasable;
}
