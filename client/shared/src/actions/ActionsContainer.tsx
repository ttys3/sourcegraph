import * as H from 'history'
import * as React from 'react'
import { ContributionScope, Context } from '../api/client/context/context'
import { ContributionOptions } from '../api/client/services/contribution'
import { ContributableMenu } from '../api/protocol'
import { getContributedActionItems } from '../contributions/contributions'
import { ExtensionsControllerProps } from '../extensions/controller'
import { PlatformContextProps } from '../platform/context'
import { TelemetryProps } from '../telemetry/telemetryService'
import { useObservable } from '../util/useObservable'
import { ActionItem, ActionItemAction } from './ActionItem'

export interface ActionsProps
    extends ExtensionsControllerProps<'executeCommand' | 'services'>,
        PlatformContextProps<'forceUpdateTooltip' | 'settings'> {
    menu: ContributableMenu
    scope?: ContributionScope
    extraContext?: Context
    listClass?: string
    location: H.Location
}
interface Props extends ActionsProps, TelemetryProps, ContributionOptions {
    /**
     * Called with the array of contributed items to produce the rendered component. If not set, uses a default
     * render function that renders a <ActionItem> for each item.
     */
    children?: (items: ActionItemAction[]) => JSX.Element | null

    /**
     * If set, it is rendered when there are no contributed items for this menu. Use null to render nothing when
     * empty.
     */
    empty?: JSX.Element | null
}

/** Displays the actions in a container, with a wrapper and/or empty element. */
export const ActionsContainer: React.FunctionComponent<Props> = ({
    scope,
    extraContext,
    returnInactiveMenuItems,
    ...props
}) => {
    const contributions = useObservable(
        React.useMemo(
            () =>
                props.extensionsController.services.contribution.getContributions({
                    scope,
                    extraContext,
                    returnInactiveMenuItems,
                }),
            [props.extensionsController, scope, extraContext, returnInactiveMenuItems]
        )
    )

    if (!contributions) {
        return null // loading
    }

    const items = getContributedActionItems(contributions, props.menu)
    if (props.empty !== undefined && items.length === 0) {
        return props.empty
    }

    const render = props.children || defaultRenderItems
    return render(items, props)
}

const defaultRenderItems = (items: ActionItemAction[], props: Props): JSX.Element | null => (
    <>
        {items.map(item => (
            <ActionItem {...props} key={item.action.id} {...item} />
        ))}
    </>
)
