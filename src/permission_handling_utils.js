import { hasATrueRule } from './security_groups_utils'

const resolvePermissions = (session, rules, target, typeResolvers, relationCache) => {
    for (const [ relation, value ] of Object.entries(rules || {})) {
        if (value) {
            const relationResolver = typeResolvers[relation]
            // todo: just throw an error?
            if (!relationResolver) return false
            relationCache[relation] = typeResolvers[relation](session, target)
            if (relationCache[relation]) {
                return true
            }
        }
    }
    return false
}

export const checkInboundQueryField = (entityName, fieldName, secGroup) => {
    // const typeResolvers = permissionResolvers[type]
    const secGroupRules = (secGroup.rules || {})[entityName] || {}
    const colRules = secGroupRules.col || {}
    return hasATrueRule(secGroupRules.row) && hasATrueRule(colRules[fieldName])
}

export const secureInboundQueryFields = (entityName, fields, secGroup) => {
    // const typeResolvers = permissionResolvers[type]
    const secGroupRules = (secGroup.rules || {})[entityName] || {}
    if (!hasATrueRule(secGroupRules.row)) {
        return null
    }
    const safeFields = []
    if (fields) {
        const fieldsArray = Array.isArray(fields) ? fields : [ fields ]
        const colRules = secGroupRules.col || {}
        for (const field of fieldsArray) {
            if (hasATrueRule(colRules[field])) {
                safeFields.push(field)
            }
        }
    }

    return safeFields
}

export const secureResult = (typeResolvers, viewer, secGroupSubGroup, target ) => {
    // const secGroupRules = secGroup.rules || {}
    const resolvedRelations = {}
    // check row rules
    if (!resolvePermissions(viewer, secGroupSubGroup.row, target, typeResolvers, resolvedRelations)) {
        return null
    }
    // check field rules
    const securedTarget = Object.assign({}, target)
    // const fieldNames = Object.keys(target)

    for (const field of Object.keys(target)) {

        const rules = (secGroupSubGroup.col || {})[field]
        // null fields that fail
        if (!resolvePermissions(viewer, rules, target, typeResolvers, resolvedRelations)) {
            delete securedTarget[field]
        }
    }
    return securedTarget

}


const regex = /(\[)?([^!\]]*)!?(?:\])?/
export const parseReturnType = (returnType) => {
    if (!returnType) {
        return {
            name: '',
            array: false,
        }
    }
    const m = regex.exec(returnType)
    if (!m) return {
        name: '',
        array: false,
    }
    const [ fullM, isArr, name ] = m // eslint-disable-line

    return {
        name,
        array: !!isArr,
    }
}

export const resolverWrapper = (rootResolver, permissionResolvers) => {

    return async (obj, args, context, info) => {
        const { security_group, viewer } = context
        const { parentType, fieldName } = info

        if (!checkInboundQueryField(parentType, fieldName, security_group)) {
            return null
        }
        const result = await rootResolver(obj, args, context, info)

        const returnType = parseReturnType(info.returnType)
        if (returnType.name && permissionResolvers[returnType.name]) {
            const returnResolver = permissionResolvers[returnType.name] || {}
            const secGroupRules = (security_group || {}).rules[returnType.name] || {}
            if (returnType.array) {
                const filteredResult = []
                let resolvedentities = result

                //
                // if at least one is a promise, resolve all as promises, conditional, because it take extra time to resolve nonpromises
                if (result[0] && result[0] instanceof Promise) {
                    resolvedentities = await Promise.all(result)
                }
                for (const item of resolvedentities) {
                    const securedResult = secureResult(returnResolver, viewer, secGroupRules, item)
                    if (securedResult) {
                        filteredResult.push(securedResult)
                    }
                }
                return filteredResult
            } else {
                const resolvedentity = result instanceof Promise ? await result : result
                return secureResult(returnResolver, viewer, secGroupRules, resolvedentity)

            }
        } else {
            return result
        }
    }
}


export const wrapResolvers = (resolvers, permissionResolvers) => {
    const wrappedResolvers = {}
    for (const [ typeName, fieldResolvers ] of Object.entries(resolvers)) {
        for (const [ fieldName, resolver ] of Object.entries(fieldResolvers)) {
            if (!wrappedResolvers[typeName]) {
                wrappedResolvers[typeName] = {}
            }
            wrappedResolvers[typeName][fieldName] = resolverWrapper(resolver, permissionResolvers)
        }
    }
    return wrappedResolvers
}
