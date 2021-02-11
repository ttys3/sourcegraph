import { add, subtract } from 'lodash'
import { useCallback, useMemo } from 'react'
import { fromEvent, merge, of, ReplaySubject, Subject } from 'rxjs'
import { map, switchMap, withLatestFrom, tap } from 'rxjs/operators'
import { useObservable } from '../../../shared/src/util/useObservable'

interface CarouselOptions {
    amountToScroll?: number
    direction: CarouselDirection
}

type CarouselDirection = 'leftToRight' | 'topToBottom'

interface CarouselState {
    canScrollNegative: boolean
    canScrollPositive: boolean
    onNegativeClicked: () => void
    onPositiveClicked: () => void
    carouselReference: React.RefCallback<HTMLElement>
}

const defaultCarouselState = { canScrollNegative: false, canScrollPositive: false }

const carouselScrollHandlers: Record<
    CarouselDirection,
    (carousel: HTMLElement) => Pick<CarouselState, 'canScrollNegative' | 'canScrollPositive'>
> = {
    leftToRight: carousel => ({
        canScrollNegative: carousel.scrollLeft > 0,
        canScrollPositive: carousel.scrollLeft + carousel.clientWidth < carousel.scrollWidth,
    }),
    topToBottom: () => ({ canScrollNegative: true, canScrollPositive: true }),
}

const carouselClickHandlers: Record<
    CarouselDirection,
    (options: { carousel: HTMLElement; amountToScroll: number; sign: 'positive' | 'negative' }) => void
> = {
    leftToRight: ({ carousel, amountToScroll, sign }) => {
        const width = carousel.clientWidth
        const offset = carousel.scrollLeft
        const operator = sign === 'positive' ? add : subtract
        carousel.scrollTo({
            top: 0,
            left: Math.max(operator(offset, width * amountToScroll), 0),
            behavior: 'smooth',
        })
    },
    topToBottom: () => {},
}

export function useCarousel({ amountToScroll = 0.9, direction }: CarouselOptions): CarouselState {
    const carouselReferences = useMemo(() => new ReplaySubject<HTMLElement | null>(1), [])
    const nextCarouselReference = useCallback((carousel: HTMLElement) => carouselReferences.next(carousel), [
        carouselReferences,
    ])

    const clicks = useMemo(() => new Subject<'positive' | 'negative'>(), [])

    const nextNegativeClick = useCallback(() => clicks.next('negative'), [clicks])
    const nextPositiveClick = useCallback(() => clicks.next('positive'), [clicks])

    // Listen for UIEvents that can affect scrollability (e.g. scroll, resize)
    const { canScrollNegative, canScrollPositive } =
        useObservable(
            useMemo(
                () =>
                    carouselReferences.pipe(
                        switchMap(carousel => {
                            if (!carousel) {
                                return of(defaultCarouselState)
                            }

                            const scrolls = fromEvent<React.UIEvent<HTMLElement>>(carousel, 'scroll')
                            const resizes = fromEvent<React.UIEvent<HTMLElement>>(window, 'resize')

                            return merge(scrolls, resizes).pipe(map(() => carouselScrollHandlers[direction](carousel)))
                        })
                    ),
                [amountToScroll, carouselReferences]
            )
        ) || defaultCarouselState

    // Handle negative and positive click events
    useObservable(
        useMemo(
            () =>
                clicks.pipe(
                    withLatestFrom(carouselReferences),
                    tap(([sign, carousel]) => {
                        if (carousel) {
                            // TODO: check if it can be scrolled before scrolling
                            carouselClickHandlers[direction]({ sign, amountToScroll, carousel })
                        }
                    })
                ),
            [amountToScroll, carouselReferences]
        )
    )

    return {
        canScrollNegative,
        canScrollPositive,
        onNegativeClicked: nextNegativeClick,
        onPositiveClicked: nextPositiveClick,
        carouselReference: nextCarouselReference,
    }
}
