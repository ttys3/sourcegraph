import React, { useCallback, useMemo } from 'react'
import { LocalStorageSubject } from '../../../../shared/src/util/LocalStorageSubject'
import { useObservable } from '../../../../shared/src/util/useObservable'
import PuzzleOutlineIcon from 'mdi-react/PuzzleOutlineIcon'
import ChevronDoubleUpIcon from 'mdi-react/ChevronDoubleUpIcon'
import { ButtonLink } from '../../../../shared/src/components/LinkOrButton'
import classNames from 'classnames'

// Action items bar and toggle are two separate components due to their placement in the DOM tree

export function useWebActionItems(): ActionItemsBarProps & ActionItemsToggleProps {
    // Need to pass in contribution point, template type. pass in default open state (we want to keep it closed on search pages by default?)
    // Should toggle state depend on context? or should all action items bars share state for consistency during navigation?
    // use template type dependent on menu/context
    const toggles = useMemo(() => new LocalStorageSubject('action-items-bar-expanded', true), [])

    const useActionItemsBar = useCallback(() => {
        // `useActionItemsBar` will be used as a hook
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const isOpen = useObservable(toggles)

        return { isOpen }
    }, [toggles])

    const useActionItemsToggle = useCallback(() => {
        // `useActionItemsToggle` will be used as a hook
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const isOpen = useObservable(toggles)

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const toggle = useCallback(() => toggles.next(!isOpen), [isOpen])

        return { isOpen, toggle }
    }, [toggles])

    return {
        useActionItemsBar,
        useActionItemsToggle,
    }
}

export interface ActionItemsBarProps {
    useActionItemsBar: () => { isOpen: boolean | undefined }
}

export interface ActionItemsToggleProps {
    useActionItemsToggle: () => {
        isOpen: boolean | undefined
        toggle: () => void
    }
    className?: string
}

export const ActionItemsBar: React.FunctionComponent<ActionItemsBarProps> = ({ useActionItemsBar }) => {
    const { isOpen } = useActionItemsBar()

    // Only fetch actions if bar is open. check if observable is memoized

    if (!isOpen) {
        return null
    }

    // TODO(tj): flex
    return (
        <div className="action-items__bar border-left position-relative">
            <ActionItemsDivider />
            <p>a</p>
            <p>b</p>
            <ActionItemsDivider />
        </div>
    )
}

export const ActionItemsToggle: React.FunctionComponent<ActionItemsToggleProps> = ({
    useActionItemsToggle,
    className,
}) => {
    const { isOpen, toggle } = useActionItemsToggle()

    return (
        <li
            data-tooltip={`${isOpen ? 'Close' : 'Open'} extensions panel`}
            className={classNames(className, 'nav-item border-left position-relative d-flex align-items-center')}
        >
            <ButtonLink
                className={classNames('py-2 action-items__toggle', isOpen && 'action-items__toggle--open')}
                onSelect={toggle}
            >
                {isOpen ? (
                    <ChevronDoubleUpIcon className="icon-inline" />
                ) : (
                    <PuzzleOutlineIcon className="icon-inline" />
                )}
            </ButtonLink>
        </li>
    )
}

const ActionItemsDivider: React.FunctionComponent<{ className?: string }> = ({ className }) => (
    <div className={classNames(className, 'action-items__divider position-absolute rounded-sm d-flex')} />
)
