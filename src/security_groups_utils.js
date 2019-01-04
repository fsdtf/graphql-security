/**
 * @module @epi/permissions
 * @export { Function } getPermissionsDescriptions
 * @export { Function } getSchemaWithPermissions
 * @export { Function } getDefaultRuleset
 * @export { Function } mergeSecurityGroupNames
 * @export { Function } mergeSecurityGroups
 * @export { Function } extractSubKeysFromRuleset
 */

/*
 "Employee": Object {
    "fields": Object {},
    "type": Object {
      "active": "Target employee is actively employed",
      "any": "Any relation of the user to the target employee",
      "dummy": "Viewer is marked as dummy",
      "own": "Currently logged in user is the target employee",
    },
  },
 */
import { IntrospectionSchema, GraphQLSchema, introspectionFromSchema } from 'graphql' // eslint-disable-line

/**
  * @param { IntrospectionSchema } schema
  * @returns { { resolverName: { fields: { relationName: string }, type: { relationName: string }} }}
  */
export const getPermissionsDescriptions = introspection => {
    const { types } = introspection.__schema

    const descriptions = types
        .filter(({ kind, name }) => kind === 'ENUM' && name.startsWith('_PermissionRelations'))
        .reduce(
            (result, type) => {
                const { name, enumValues } = type
                const releavant_name = name.slice('_PermissionRelations_'.length)
                const enumDescriptions = enumValues.reduce((r, c) => {
                    r[c.name] = c.description || c.name
                    return r
                }, {})
                const [ typeName, fieldName ] = releavant_name.split('_')
                if (!result[typeName]) {
                    result[typeName] = {
                        fields: {},
                        type: {},
                    }
                }
                if (fieldName) {
                    result[typeName].fields[fieldName] = enumDescriptions
                } else {
                    result[typeName].type = enumDescriptions
                }
                return result
            }
            , {})
    return descriptions
}

/**
 *
 * @param { GraphQLSchema } schema
 */
export const getSchemaWithPermissions = schema => {
    const introspection = introspectionFromSchema(schema)
    const { types } = introspection.__schema
    const descriptions = getPermissionsDescriptions(introspection)
    return types

        .map(type => {

            const { name, fields, kind } = type
            if (kind === 'OBJECT' && !name.startsWith('_')) {
                const typeDescriptor = descriptions[name] || {}
                const generalTypePermissions = { any: 'any relation', ...typeDescriptor.type || {} }
                const enhanced_fields = fields.map(field => {
                    const fieldDescriptor = typeDescriptor.fields || {}
                    const permissions = { ...generalTypePermissions, ...fieldDescriptor[field.name] || {} }
                    return {
                        ...field,
                        permissions,
                    }
                })
                return { ...type, fields: enhanced_fields }
            } else {
                return type
            }

        }, {})
}

/**
 *
 * @param { GraphQLSchema } schema
 */
export const getDefaultRuleset = schema => {
    const introspection = introspectionFromSchema(schema)
    const { types } = introspection.__schema
    const descriptions = getPermissionsDescriptions(introspection)

    const descToPerm = desc => ({ any: false, ...Object.keys(desc || {}).reduce((r, k) => {
        r[k] = false
        return r
    }, {}) })
    const rules = types
        .filter(({ kind, name }) => kind === 'OBJECT' && !name.startsWith('_'))
        .reduce((result, type) => {
            const { name, fields } = type
            const typeDescriptor = descriptions[name] || { fields: {} }
            const row = descToPerm(typeDescriptor.type)
            const col = fields.reduce((res, field) => {
                res[field.name] = {
                    ...row,
                    ...descToPerm(typeDescriptor.fields[field.name]),
                }
                // id any is always true, this is to avoid very silly mistakes, if you can read the row, id is accessible!
                if (field.name === 'id') {

                    res[field.name].any = true
                }
                return res
            }, {})
            result[name] = { row, col }
            return result
        }, {})

    return {
        id: '0000000000000-0000-0000-111111111111',
        rules,
    }
}


/**
 * @name mergeSecurityGroupNames
 * @arg { [string] } names list of rule names
 * @desc Create a unique and reproducible identifier for a merged security group.
 * - Prefixed with underscores. (Making it easily visible that you are dealing with a merged group)
 * - Order of the groups when merging does not matter.
 */
export const mergeSecurityGroupNames = (names) =>
    '__' + names
        .filter(n => !!n)// ignore falsy names
        .sort().join('_').toLowerCase()

/**
 * @name mergeSecurityRuleSets
 * @private true
 * @arg { [Object] } objs list of objects
 */
const mergeSecurityRuleSets = (...ruleSets) => {
    const combinedRuleSet = {}

    for (const ruleSet of ruleSets)
        for (const ruleName of Object.keys(ruleSet))
            // only if specified
            if (ruleSet[ruleName] === false || ruleSet[ruleName] === true)
                combinedRuleSet[ruleName] = Boolean(ruleSet[ruleName])

    return combinedRuleSet
}

/**
 * @name mergeSecurityGroups
 * @arg { [Object] } groups List of security groups
 * @desc Essential Security Group Structure:
 *
 *     {
 *         name: 'employee',
 *         rules: {
 *             <objectTypeName> : {
 *                 row : <ruleSet>,
 *                 col : {
 *                     <columnName> : <ruleSet>
 *                 }
 *             }
 *         }
 *     }
 */
export const mergeSecurityGroups = (...groups) => {
    const combinedGroup = {
        name: mergeSecurityGroupNames(groups.map(g => g.name)),
        rules: {},
    }

    for (const group of groups) if (group.rules) {

        // for every object type
        for (const objectTypeName of Object.keys(group.rules)) {

            // get combinedObjectType
            const combinedObjectType =
                combinedGroup.rules[objectTypeName] ||
                (combinedGroup.rules[objectTypeName] = {
                    row: {},
                    col: {},
                })

            const nextObjectType =
                group.rules[objectTypeName] || {}

            // merge objectType.row
            combinedObjectType.row = mergeSecurityRuleSets(
                combinedObjectType.row || {},
                nextObjectType.row || {}
            )

            // merge objectType.col
            for (const columnName of Object.keys(nextObjectType.col || {})) {
                combinedObjectType.col[columnName] = mergeSecurityRuleSets(
                    combinedObjectType.col[columnName] || {},
                    nextObjectType.col[columnName] || {}
                )
            }
        }
    }

    return combinedGroup
}

export function hasATrueRule (rules) {
    return Object.values(rules || {}).some(Boolean)
}


/**
 *
 * @param { GraphQLSchema } schema
 */
export const verifySchemaAndPermissionResolvers = (schema, permissionResolvers) => {
    const errors = []
    const introspection = introspectionFromSchema(schema)
    const { types } = introspection.__schema

    const typeMap = new Map(Object.entries(types
        .filter(({ kind, name }) => kind === 'OBJECT' && !name.startsWith('_'))
        .reduce((result, type) => {
            result[type.name] = {
                fields: type.fields.map(f => f.name),
            }
            return result
        }, {})))

    const permissionDescriptions = getPermissionsDescriptions(introspection)
    const remaigningEnums = { ...permissionDescriptions }
    const remainingResolvers = { ...permissionResolvers }

    for (const [ type, { fields }] of typeMap) {

        // check enum types
        if (remaigningEnums[type]) {
            const enumFields = Object.keys(remaigningEnums[type].fields || {})
            if (enumFields.length > 0) {
                for (const enumField of enumFields)
                    if (!fields.includes(enumField)) {
                        errors.push({
                            error: 'invalid_enum_field',
                            level: 'warn',
                            message: `_PermissionRelations_${ type }_${ enumField } enum references a nonexisting field: ${ type }.${ enumField }`,
                            type,
                            field: enumField,
                        })
                    }
            }

            delete remaigningEnums[type]
        } else {
            errors.push({
                error: 'missing_relation_enum',
                message: `Missing enum _PermissionRelations_${ type }`,
                level: 'error',
                type,
            })
        }
        // check permission types
        if (remainingResolvers[type]) {
            delete remainingResolvers[type]
        } else {
            errors.push({
                error: 'missing_permission_resolver',
                message: `Missing permission resolver ${ type }`,
                level: 'error',
                type,
            })
        }
    }
    Object.keys(remaigningEnums).forEach(type => {
        errors.push({
            error: 'invalid_relation_enum',
            message: `Relations enum _PermissionRelations_${ type } not found in schema`,
            level: 'warn',
            type,
        })
    })
    Object.keys(remainingResolvers).forEach(type => {
        errors.push({
            error: 'invalid_permission_resolver',
            message: `Resolver ${ type } references a nonexisting type`,
            level: 'warn',
            type,
        })
    })

    const relevantPresolvers = new Map(Object.entries(permissionResolvers).filter(([ t ]) => !remainingResolvers[t] && permissionDescriptions[t]))


    const relevantEnums = new Map(Object.entries(permissionDescriptions)
        .filter(([ t ]) => !remaigningEnums[t] && permissionResolvers[t])
        .map(([ k, v ]) => [
            k,
            { ...Object.values(v.fields).reduce((r, k) => ({ ...r, ...Object.keys(k).reduce((r, k) => ({ ...r, [k]: k }), {}) }), {}), ...v.type }]))

    for (const [ resolverType, v ] of relevantPresolvers) {
        Object.keys(v).forEach(relation => {
            const enumType = relevantEnums.get(resolverType)
            if (enumType[relation]) {
                delete enumType[relation]
                if (!Object.keys(enumType).length ) {
                    relevantEnums.delete(relation)
                }
            } else {
                errors.push({
                    error: 'invalid_permission_resolver_value',
                    message: `Invalid permission relation resolver ${ resolverType }.${ relation }: not found in enum _PermissionRelations_${ resolverType }`,
                    level: 'warn',
                    type: resolverType,
                    field: relation,
                })
            }
        })
        // relevantEnums
    }
    relevantEnums.forEach(
        (fields, type) => {
            Object.keys(fields).forEach(field => errors.push({
                error: 'missing_permission_resolver_value',
                message: `Resolver ${ type }.${ field } is not defined, but speicified in enum _PermissionRelations_${ type }`,
                level: 'error',
                type,
                field,
            })
            )
        })

    return errors
}
