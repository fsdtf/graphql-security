// __tests__/automocking.test.js
import {
    secureResult,
    checkInboundQueryField,
    secureInboundQueryFields,
    resolverWrapper,
    parseReturnType,
    wrapResolvers,
} from '../permission_handling_utils'
import {
    mergeSecurityGroups,
    getDefaultRuleset,
} from '../security_groups_utils'
import dummySchema from './resources/dummySchema'


const permResolvers = {
    Employee: {
        any () {
            return true
        },
        own ({ viewer }, employee) {
            return viewer.id === employee.id
        },
        superior ({ viewer }, employee) {
            return (viewer.mentor || {}).id === employee.id
        },
        active (viewer, employee) {
            return !employee.suspended
        },
        dummy ({ viewer }) {
            return !!viewer.dummy
        },
    },
}

const secGroup = mergeSecurityGroups(
    getDefaultRuleset(dummySchema),
    {
        name: 'test Group',
        rules: {
            Query: {
                row: {
                    any: true,
                },
                col: {
                    employee: {
                        any: true,
                    },
                },
            },
            Employee: {
                row: {
                    any: true,
                },
                col: {
                    id: {
                        any: true,
                    },
                    ownProp: {
                        own: false,
                    },
                    first_name: {
                        own: true,
                    },
                    email: {
                        any: true,
                        own: false,
                        else: false,
                    },
                },
            },
            Project: {
                row: {
                    any: false,
                    own: false,
                },
            },
        },
    }
)


describe('secureResult()', () => {
    // export const resolveEntity = (viewer, secGroup, target ) => {
    const demoUser = {
        id: 'test_empl',
        email: 'test@etventure.com',
    }
    const demoEmpl = {
        id: 'test_empl1',
        ownProp: 'woot woot',
        email: 'test@mail.com',
    }
    // console.log(secGroup.rules.Employee)
    // const o = Date.now()
    // for (let i = 0; i < 10000; i++) {
    //     const processedentity = secureResult(
    //         demoUser,
    //         secGroup,
    //         demoEmpl

    //     )
    // }
    // const n = Date.now()
    // console.log(n - o)
    it('check snap', () => {
        expect(secureResult(
            permResolvers['Employee'],
            demoUser,
            secGroup.rules['Employee'],
            demoEmpl

        )).toMatchSnapshot()
    })
})

describe('checkInboundQueryField', () => {

    // entity, secGroup, fields
    it('Fails on row', () => {
        expect(checkInboundQueryField('Project', 'id', secGroup)).toBe(false)
    })

    it('single field', () => {
        expect(checkInboundQueryField('Employee', 'id', secGroup)).toBe(true)
        expect(checkInboundQueryField('Employee', 'ownProp', secGroup)).toBe(false)
        expect(checkInboundQueryField('Employee', 'email', secGroup)).toBe(true)
    })
})

describe('secureInboundQueryFields', () => {

    // entity, secGroup, fields
    it('Fails on row', () => {
        expect(secureInboundQueryFields('Project', 'id', secGroup)).toBeNull()
    })

    it('single field', () => {
        expect(secureInboundQueryFields('Employee', 'id', secGroup)).toEqual([ 'id' ])
    })
    it('mutltiple fields', () => {
        expect(secureInboundQueryFields('Employee', [ 'id', 'ownProp' ], secGroup)).toEqual([ 'id' ])
    })

})

describe('parseReturnType()', () => {
    it('falsy', () => {
        const falsyResult = { name: '', array: false }
        expect(parseReturnType()).toEqual(falsyResult)
        expect(parseReturnType(null)).toEqual(falsyResult)
        expect(parseReturnType(false)).toEqual(falsyResult)
        expect(parseReturnType(0)).toEqual(falsyResult)
        expect(parseReturnType(NaN)).toEqual(falsyResult)
    })
    it('single required', () => {
        expect(parseReturnType('Employee!')).toEqual({ name: 'Employee', array: false })
    })
    it('single optional', () => {
        expect(parseReturnType('Employee')).toEqual({ name: 'Employee', array: false })
    })
    it('array optional', () => {
        expect(parseReturnType('[Employee]')).toEqual({ name: 'Employee', array: true })
    })
    it('array required', () => {
        expect(parseReturnType('[Employee]!')).toEqual({ name: 'Employee', array: true })
    })
    it('array non-null', () => {
        expect(parseReturnType('[Employee!]')).toEqual({ name: 'Employee', array: true })
    })
})


describe('resolverWrapper()', () => {
    const resolverArgsSingle = [
        null, null, {
            security_group: secGroup,
            viewer: {
                id: 'id1',
            },
        }, {
            parentType: 'Query',
            fieldName: 'employee',
            returnType: 'Employee',
        },
    ]

    const resolverArgsMany = [
        null, null, {
            security_group: mergeSecurityGroups(
                secGroup,
                {
                    name: 'test Group 2',
                    rules: {
                        Employee: {
                            row: {
                                any: false,
                                dummy: true,
                            },
                        },
                    },
                }
            ),
            viewer: {
                id: 'id1',
                dummy: true,
            },
        }, {
            parentType: 'Query',
            fieldName: 'employee',
            returnType: '[Employee]',
        },
    ]

    const resolverRunner = (resolver, args) => {
        const wrappedResolver = resolverWrapper(resolver, permResolvers )
        return wrappedResolver(...args)
    }

    it('check inbout reject', async () => {
        const result = await resolverRunner(() => 'test', [ null, null,
            resolverArgsMany[2], {
                parentType: 'Employee',
                fieldName: 'ownProp',
                returnType: 'String',
            },
        ])
        expect(result).toBeNull()
    })
    it('pass if no permission resolver for type', async () => {
        const result = await resolverRunner(() => 'test', [ null, null,
            resolverArgsMany[2], {
                parentType: 'Employee',
                fieldName: 'id',
                returnType: 'Bloop',
            },
        ])
        expect(result).toEqual('test')
    })
    it('check single', async () => {
        const result = await resolverRunner(() => ({
            id: 'id',
            first_name: 'first_name',
            email: 'email',
        }), resolverArgsSingle)
        expect(result).toMatchSnapshot()
    })
    it('check single promise', async () => {
        const result = await resolverRunner(() => Promise.resolve({
            id: 'id',
            first_name: 'first_name',
            email: 'email',
        }), resolverArgsSingle)
        expect(result).toMatchSnapshot()
    })
    it('check many', async () => {

        const result = await resolverRunner(() => [
            {
                id: 'id1',
                first_name: 'first_name',
                email: 'email',
            },
            {
                id: 'id2',
                first_name: 'first_name2',
                email: 'email2',
            },
        ], resolverArgsMany)
        expect(result).toMatchSnapshot()
    })
    it('check many, no row permission', async () => {
        const newResolverArgs = [ ...resolverArgsMany ]
        newResolverArgs[2] = {
            ...newResolverArgs[2],
            viewer: {
                id: 'id1',
                dummy: false,
            },
        }
        const result = await resolverRunner(() => [
            {
                id: 'id1',
                first_name: 'first_name',
                email: 'email',
            },
            {
                id: 'id2',
                first_name: 'first_name2',
                email: 'email2',
            },
        ], newResolverArgs)
        expect(result).toHaveLength(0)
    })
    it('check many promise', async () => {
        const result = await resolverRunner(() => [
            Promise.resolve({
                id: 'id1',
                first_name: 'first_name',
                email: 'email',
            }),
            Promise.resolve({
                id: 'id2',
                first_name: 'first_name2',
                email: 'email2',
            }),
        ], resolverArgsMany)
        expect(result).toMatchSnapshot()
    })
//     it(resolverWrapper)
})

describe('wrapResolvers', () => {
    it('check snapshot', () => {
        const resolvers = {
            Entity: {
                id: () => {},
            },
        }
        expect(wrapResolvers(resolvers, permResolvers)).toMatchSnapshot()
    })
})
