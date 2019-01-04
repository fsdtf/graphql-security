// __tests__/automocking.test.js
import {
    getPermissionsDescriptions,
    getSchemaWithPermissions,
    getDefaultRuleset,
    mergeSecurityGroups,
    verifySchemaAndPermissionResolvers,
} from '../security_groups_utils'
import { introspectionFromSchema } from 'graphql'
import dummySchema from './resources/dummySchema'
import * as dummySecurityGroups from './resources/dummySecurityGroups'

describe('getPermissionsDescriptions()', () => {
    it('snapshot check', () => {
        expect(getPermissionsDescriptions(introspectionFromSchema(dummySchema))).toMatchSnapshot()
    })
})

describe('getSchemaWithPermissions()', () => {
    it('snapshot  check', () => {
        // console.log(buildClientSchema(dummySchema))
        expect(getSchemaWithPermissions(dummySchema)).toMatchSnapshot()
    }
    )
})

describe('getDefaultRuleset()', () => {
    it('snapshot  check', () => {
        expect(getDefaultRuleset(dummySchema)).toMatchSnapshot()
    })
})

describe('mergeSecurityGroups()', () => {
    const { A, B, C, D } = dummySecurityGroups
    it('should be a function', () => {
        expect(typeof mergeSecurityGroups).toBe('function')
    })

    it('should return structurally uniform objects', () => {
        const g = mergeSecurityGroups(A, B, C, D)
        expect(typeof g.name).toBe('string')
        expect(typeof g.rules).toBe('object')
        expect(g.rules).toBeInstanceOf(Object)
    })

    it('should merge group names lower cased with a dunderscore prefix', () => {
        const mergedGroup = mergeSecurityGroups(A, B)
        expect(mergedGroup.name).toBe('__alpha_bravo')
    })

    it('should merge group names alphabetically', () => {
        const one = mergeSecurityGroups(D, B, A, C)
        const two = mergeSecurityGroups(C, D, B, A)
        const orderedName = '__alpha_bravo_charlie_delta'

        expect(one.name).toBe(orderedName)
        expect(two.name).toBe(orderedName)
    })

    describe('merged groups', () => {
        const C_D = mergeSecurityGroups(C, D)
        const D_C = mergeSecurityGroups(D, C)

        it('should override row rights', () => {
            expect(C.rules.Employee.row.isDisabled).toEqual(false)
            expect(D.rules.Employee.row.isDisabled).toEqual(true)
            expect(C_D.rules.Employee.row.isDisabled).toEqual(true)
            expect(D_C.rules.Employee.row.isDisabled).toEqual(false)
        })

        it('should override col rights', () => {
            expect(C.rules.Employee.col.id.subordinate).toEqual(true)
            expect(D.rules.Employee.col.id.subordinate).toEqual(false)
            expect(C_D.rules.Employee.col.id.subordinate).toEqual(false)
            expect(D_C.rules.Employee.col.id.subordinate).toEqual(true)
        })
        it('if not specified, should not row override', () => {
            expect(C_D.rules.Employee.row.own).toEqual(true)
            expect(D_C.rules.Employee.row.own).toEqual(true)
        })
        it('if not specified, should not col override', () => {
            expect(C_D.rules.Employee.col.id.own).toEqual(true)
            expect(D_C.rules.Employee.col.id.own).toEqual(true)
        })
    })
})
import { buildSchema } from 'graphql'
describe('verifySchemaAndPermissionResolvers()', () => {
    const permResolvers = {
        Query: {
            any: () => {},
            invalidRelation: () => {},
        },
        Post: {
            any: () => {},
        },
        NoType: {
            any: () => {},
        },
    }

    const schema1 = buildSchema(`
        enum _PermissionRelations_User{
            any
        }
        enum _PermissionRelations_Query{
            noResolver1
            any
        }
        enum _PermissionRelations_Query_nonExistingField{
            any
            #shouldnt apear
            noResolver2
        }
        enum _PermissionRelations_NonExisting{
            any
        }
        type User {
          id: ID!
          name: String
        }
        type Post {
            id: ID!
            name: String
        }
        type Query {
           me: User
           post: Post
        }
        schema {
          query: Query

        }
      `
    )
    it('check snapshot', () => {
        expect(verifySchemaAndPermissionResolvers(schema1, permResolvers)).toMatchSnapshot()
    })
})
