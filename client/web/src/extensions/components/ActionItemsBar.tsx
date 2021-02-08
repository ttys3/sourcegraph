import React, { useCallback, useMemo } from 'react'
import { LocalStorageSubject } from '../../../../shared/src/util/LocalStorageSubject'
import { useObservable } from '../../../../shared/src/util/useObservable'
import PuzzleOutlineIcon from 'mdi-react/PuzzleOutlineIcon'
import ChevronDoubleUpIcon from 'mdi-react/ChevronDoubleUpIcon'
import { ButtonLink } from '../../../../shared/src/components/LinkOrButton'
import classNames from 'classnames'
import { ActionsContainer } from '../../../../shared/src/actions/ActionsContainer'
import { ContributableMenu } from '../../../../shared/src/api/protocol'
import { ExtensionsControllerProps } from '../../../../shared/src/extensions/controller'
import * as H from 'history'
import { PlatformContextProps } from '../../../../shared/src/platform/context'
import { TelemetryProps } from '../../../../shared/src/telemetry/telemetryService'
import { ActionItem } from '../../../../shared/src/actions/ActionItem'
import PlusIcon from 'mdi-react/PlusIcon'
import { Link } from 'react-router-dom'

// Action items bar and toggle are two separate components due to their placement in the DOM tree

export function useWebActionItems(): Pick<ActionItemsBarProps, 'useActionItemsBar'> &
    Pick<ActionItemsToggleProps, 'useActionItemsToggle'> {
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

export interface ActionItemsBarProps extends ExtensionsControllerProps, PlatformContextProps, TelemetryProps {
    useActionItemsBar: () => { isOpen: boolean | undefined }
    location: H.Location
}

export interface ActionItemsToggleProps {
    useActionItemsToggle: () => {
        isOpen: boolean | undefined
        toggle: () => void
    }
    className?: string
}

/**
 *
 */
export const ActionItemsBar = React.memo<ActionItemsBarProps>(props => {
    const { isOpen } = props.useActionItemsBar()

    if (!isOpen) {
        return null
    }

    return (
        <div className="action-items__bar p-0 border-left position-relative">
            <ActionItemsDivider />
            <ActionsContainer
                menu={ContributableMenu.EditorTitle}
                extensionsController={props.extensionsController}
                empty={<p>No extensions</p>}
                location={props.location}
                platformContext={props.platformContext}
                telemetryService={props.telemetryService}
            >
                {items => (
                    <ul className="list-unstyled m-0">
                        {items.map(item => (
                            <li key={item.action.id} className="action-items__list-item">
                                <ActionItem
                                    {...props}
                                    {...item}
                                    className="action-items__action  d-block"
                                    variant="actionItem"
                                    iconClassName="icon-inline"
                                    pressedClassName="action-items__action--pressed"
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </ActionsContainer>
            <ActionItemsDivider />
            <Link
                to="/extensions"
                className="nav-link action-items__action action-items__list-item"
                data-tooltip="Add extensions"
            >
                <PlusIcon className="icon-inline" />
            </Link>
        </div>
    )
})

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
    <li className={classNames(className, 'action-items__divider position-absolute rounded-sm d-flex')} />
)
