/**
 * Reports Data Definitions
 * Site Survey + Quality Checklist data for DC Studio Reports
 */

// ============================================================
// SITE SURVEY DATA
// ============================================================

var SITE_SURVEY_FLOOR_ITEMS = [
  {
    id: 'floor-1',
    label: 'Detail measurement of floor',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'f1-1', label: 'Floor dimensions', type: 'text', placeholder: 'Enter floor dimensions (e.g., Length x Width)' }
    ]
  },
  {
    id: 'floor-2',
    label: 'Detail measurement of column, inclusive distance between column and wall',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'f2-1', label: 'Add dimensions', type: 'text', placeholder: 'Enter column dimensions and distances' }
    ]
  },
  {
    id: 'floor-3',
    label: 'Record existing junction box (tel., data, power)',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record all junction box locations and types...'
  },
  {
    id: 'floor-4',
    label: 'Record and measure existing drain pipe',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record drain pipe locations, sizes, and measurements...'
  },
  {
    id: 'floor-5',
    label: 'Record other details (like stair form, floor material and floor level)',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record stair forms, floor materials, floor levels, and other relevant details...'
  },
  {
    id: 'floor-6',
    label: 'Record difference between original concrete floor and existing floor',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'f6-1', label: 'Floor level Difference', type: 'text', placeholder: 'Enter difference in mm or inches' }
    ]
  }
];

var SITE_SURVEY_WALL_ITEMS = [
  {
    id: 'wall-1',
    label: 'Measure all different corners (at least 6 different locations)',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'w1-1', label: 'Dimensions of Diagonals', type: 'number', placeholder: 'Diagonal 1 (mm)' },
      { id: 'w1-2', label: 'Dimensions of Diagonals', type: 'number', placeholder: 'Diagonal 2 (mm)' },
      { id: 'w1-3', label: 'Dimensions of Diagonals', type: 'number', placeholder: 'Diagonal 3 (mm)' },
      { id: 'w1-4', label: 'Dimensions of Diagonals', type: 'number', placeholder: 'Diagonal 4 (mm)' },
      { id: 'w1-5', label: 'Dimensions of Diagonals', type: 'number', placeholder: 'Diagonal 5 (mm)' },
      { id: 'w1-6', label: 'Dimensions of Diagonals', type: 'number', placeholder: 'Diagonal 6 (mm)' }
    ]
  },
  {
    id: 'wall-2',
    label: 'Measure height from existing ceiling to concrete slab',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'w2-1', label: 'Ceiling to slab dimension', type: 'number', placeholder: 'Height in mm' }
    ]
  },
  {
    id: 'wall-3',
    label: 'Detail measurement for square column (4 sides)',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'w3-1', label: 'Dimensions of Column', type: 'number', placeholder: 'Side 1 (mm)' },
      { id: 'w3-2', label: 'Dimensions of Column', type: 'number', placeholder: 'Side 2 (mm)' },
      { id: 'w3-3', label: 'Dimensions of Column', type: 'number', placeholder: 'Side 3 (mm)' },
      { id: 'w3-4', label: 'Dimensions of Column', type: 'number', placeholder: 'Side 4 (mm)' }
    ]
  },
  {
    id: 'wall-4',
    label: 'Detail measurement for round column (circumference & diameter)',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'w4-1', label: 'Circumference', type: 'number', placeholder: 'Circumference in mm' },
      { id: 'w4-2', label: 'Diameter', type: 'number', placeholder: 'Diameter in mm' }
    ]
  },
  {
    id: 'wall-5',
    label: 'Detail measurement for existing all windows and doors',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'w5-1', label: 'Door Height', type: 'number', placeholder: 'Height in mm' },
      { id: 'w5-2', label: 'Door Width', type: 'number', placeholder: 'Width in mm' },
      { id: 'w5-3', label: 'Window Cill', type: 'number', placeholder: 'Cill height in mm' },
      { id: 'w5-4', label: 'Window Lintel', type: 'number', placeholder: 'Lintel height in mm' },
      { id: 'w5-5', label: 'Window width', type: 'number', placeholder: 'Width in mm' }
    ]
  },
  {
    id: 'wall-6',
    label: 'Detail measurement between existing windows or existing door',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'w6-1', label: 'Measurement between existing windows or existing door', type: 'number', placeholder: 'Distance in mm' }
    ]
  },
  {
    id: 'wall-7',
    label: 'Record existing material of the wall (brick wall, concrete wall, gypsum board or others)',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record wall materials and types...'
  },
  {
    id: 'wall-8',
    label: 'Record and measure all dimensions between gaps from window, wall to ceiling',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record gap dimensions and measurements...'
  },
  {
    id: 'wall-9',
    label: 'Record and measure drain pipe',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record drain pipe locations and measurements...'
  },
  {
    id: 'wall-10',
    label: 'Record and measure existing power points, telephone points and data sockets',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record all electrical and data point locations...'
  },
  {
    id: 'wall-11',
    label: 'Record and measure skirting',
    type: 'multiple',
    hasMedia: true,
    hasMultipleFields: true,
    fields: [
      { id: 'w11-1', label: 'Skirting Height', type: 'number', placeholder: 'Height in mm' }
    ]
  },
  {
    id: 'wall-12',
    label: 'Record and measure existing MD box, PABX box, fire system box, alarm system box and others',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record all system boxes, locations, and specifications...'
  },
  {
    id: 'wall-13',
    label: 'Record and measure existing wall lighting',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record wall lighting types, locations, and measurements...'
  },
  {
    id: 'wall-14',
    label: 'Record existing paints',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record paint types, colors, and conditions...'
  },
  {
    id: 'wall-15',
    label: 'Record and measure air-conditioning split unit or window unit',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record AC unit types, locations, and specifications...'
  },
  {
    id: 'wall-16',
    label: 'Record and measure existing wall cabinet',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record wall cabinet details and measurements...'
  },
  {
    id: 'wall-17',
    label: 'Record and measure air-conditioning thermostat',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record thermostat locations and specifications...'
  },
  {
    id: 'wall-18',
    label: 'Record and measure curtain, blind (horizontal, vertical, bamboo etc.)',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record curtain/blind types, measurements, and locations...'
  }
];

var SITE_SURVEY_OTHER_ITEMS = [
  {
    id: 'other-1',
    label: 'Record and measure all existing furniture',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record furniture types, dimensions, and locations...'
  },
  {
    id: 'other-2',
    label: 'Record and measure all existing doors and windows',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record door and window details, types, and measurements...'
  },
  {
    id: 'other-3',
    label: 'Record and measure all existing joinery',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record joinery details, types, and measurements...'
  },
  {
    id: 'other-4',
    label: 'Record and measure all existing equipments',
    type: 'textarea',
    hasMedia: true,
    placeholder: 'Record equipment types, specifications, and locations...'
  }
];

// ============================================================
// QUALITY CHECKLIST DATA (13 sections, 3-tier)
// ============================================================

var QUALITY_CHECKLIST_SECTIONS = [
  {
    id: 'screeding',
    name: 'Screeding',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'screeding-before-start-of-work-1', label: 'Is the layout marking and floor levels verified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-before-start-of-work-2', label: 'Is the sub base cleaned before taking up the laying of screed?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-before-start-of-work-3', label: 'Are the material grades as per the specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-before-start-of-work-4', label: 'Are the conduits, raceways and junction boxes laid as per the requirement?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-before-start-of-work-5', label: 'Is the level of raceways and junction boxes verified? (Is there adequate clearance on top of the raceways for the adherence of the screed?)', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'screeding-during-execution-1', label: 'Is the screeding being done uniformly?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-during-execution-2', label: 'Is the mix of the screed as per the specifications?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'screeding-post-completion-1', label: 'Has the levels of the finished floor been checked before the setting of the screed?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-post-completion-2', label: 'Is the finished floor being cured adequately?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-post-completion-3', label: 'Is the level of the junction boxes in line with the finished floor level?', type: 'percentage-remarks', hasMedia: true },
          { id: 'screeding-post-completion-4', label: 'Is the position of output cables and wire entry in place?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'framework',
    name: 'Framework',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'framework-before-start-of-work-1', label: 'Is the marking for partitions verified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'framework-before-start-of-work-2', label: 'Is the material used for framework as per the specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'framework-before-start-of-work-3', label: 'Have the routes for services been verified before making provisions for the same?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'framework-during-execution-1', label: 'Is the sizing and spacing of the members being done appropriately?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'framework-post-completion-1', label: 'Is the fixing arrangement for the framework executed as per the drawing?', type: 'percentage-remarks', hasMedia: true },
          { id: 'framework-post-completion-2', label: 'Is the framework provided with additional support members for accomodating service boxes?', type: 'percentage-remarks', hasMedia: true },
          { id: 'framework-post-completion-3', label: 'Is the counter sunk application of fixing hardwares followed?', type: 'percentage-remarks', hasMedia: true },
          { id: 'framework-post-completion-4', label: 'Are highly rigid joints in the wooden framework avoided? (Is it ensured that atleast 1mm gaps are left at the joints for expansion?)', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'partitions',
    name: 'Partitions',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'partitions-before-start-of-work-1', label: 'Has the alignment and levelling of the framework been checked before skinning?', type: 'percentage-remarks', hasMedia: true },
          { id: 'partitions-before-start-of-work-2', label: 'Is it ensured that the necessary services works are complete before start of skinning?', type: 'percentage-remarks', hasMedia: true },
          { id: 'partitions-before-start-of-work-3', label: 'Are all wiring works complete?', type: 'percentage-remarks', hasMedia: true },
          { id: 'partitions-before-start-of-work-4', label: 'Are all service metal boxes fixed and their positions verified with spirit levels?', type: 'percentage-remarks', hasMedia: true },
          { id: 'partitions-before-start-of-work-5', label: 'Is anti-termite treatment done to the members before taking up skinning?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'partitions-during-execution-1', label: 'Are the joints being staggered for double skinning?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'partitions-post-completion-1', label: 'Does the plumb of gypsum partition match with the skirting below?', type: 'percentage-remarks', hasMedia: true },
          { id: 'partitions-post-completion-2', label: 'Are all the cutouts required in the partition made?', type: 'percentage-remarks', hasMedia: true },
          { id: 'partitions-post-completion-3', label: 'Are gaps at the joints of the skinning material avoided?', type: 'percentage-remarks', hasMedia: true },
          { id: 'partitions-post-completion-4', label: 'Is the counter sunk application of fixing hardwares followed.', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'door-frames-shutters',
    name: 'Door Frames & Shutters',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'door-frames---shutters-before-start-of-work-1', label: 'Is the make of material as per the specification?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-before-start-of-work-2', label: 'Is the grade and quality of hardware fixtures as per specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-before-start-of-work-3', label: 'Are provisions for holdfasts made for door frames to be fixed on walls?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-before-start-of-work-4', label: 'Is the wood used free of moisture?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-before-start-of-work-5', label: 'Is the wood used for the door frames and shutters seasoned and free of knots?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-before-start-of-work-6', label: 'Does the door shutter size take into account the finished floor level?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'door-frames---shutters-during-execution-1', label: 'Is the door frame erected beneath finished floor?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-during-execution-2', label: 'Is wood primer applied on the door frames?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-during-execution-3', label: 'Is fire-retardant / anti-termite treatment done to the wooden members?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-during-execution-4', label: 'Is the fire-retardant / anti-termite paint used of the approved make?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'door-frames---shutters-post-completion-1', label: 'Do the door shutters have bends or warpages?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-post-completion-2', label: 'Are the door hardwares such as locks and handles fixed with the specified spacing?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-post-completion-3', label: 'Is the hardware integrated with access control system as per the requirements?', type: 'percentage-remarks', hasMedia: true },
          { id: 'door-frames---shutters-post-completion-4', label: 'Are all the door hardwares required to be fixed on the floor completed before the carpet is laid?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'gyp-ceiling-framework',
    name: 'Gyp. Ceiling Framework',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'gyp--ceiling-framework-before-start-of-work-1', label: 'Is the initial marking as per the Reflected Ceiling Plan verified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp--ceiling-framework-before-start-of-work-2', label: 'Are the grades of materials used for framework as per the specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp--ceiling-framework-before-start-of-work-3', label: 'Are the required service works above the false ceiling complete?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'gyp--ceiling-framework-during-execution-1', label: 'Is the level and alignment of framework maintained?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'gyp--ceiling-framework-post-completion-1', label: 'Wherever the channels or members of the framework are cut for erecting fixtures, are additional supports provided?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp--ceiling-framework-post-completion-2', label: 'Are the levels and alignment of framework as per the requirement?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp--ceiling-framework-post-completion-3', label: 'Are the spacing and supporting angles of framework appropriate to take up gypsum ceiling fixing?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'gyp-ceiling-fixing',
    name: 'Gyp. Ceiling Fixing',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'gyp-ceiling-fixing-before-start-of-work-1', label: 'Were the alignment and levels of the framework checked before gypsum ceiling fixing?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp-ceiling-fixing-before-start-of-work-2', label: 'Are the materials used as per the specifications and are of the approved make?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp-ceiling-fixing-before-start-of-work-3', label: 'Are all the services works complete?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'gyp-ceiling-fixing-during-execution-1', label: 'Is the level being maintained while fixing the gypsum board?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'gyp-ceiling-fixing-post-completion-1', label: 'Is the level and alignment of the gypsum ceiling verified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp-ceiling-fixing-post-completion-2', label: 'Are the cutouts for grills and fixtures complete?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp-ceiling-fixing-post-completion-3', label: 'Are the joints in the gypsum ceiling sealed properly?', type: 'percentage-remarks', hasMedia: true },
          { id: 'gyp-ceiling-fixing-post-completion-4', label: 'Has the boarding been sanded thoroughly to take the top coat and painting?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'grid-ceiling',
    name: 'Grid Ceiling',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'grid-ceiling-before-start-of-work-1', label: 'Are the service works of other work packages, viz., HVAC, Electrical and Fire Fighting underneath the false ceiling fully complete?', type: 'percentage-remarks', hasMedia: true },
          { id: 'grid-ceiling-before-start-of-work-2', label: 'Is the alignment of framework checked?', type: 'percentage-remarks', hasMedia: true },
          { id: 'grid-ceiling-before-start-of-work-3', label: 'Is the framework levelled?', type: 'percentage-remarks', hasMedia: true },
          { id: 'grid-ceiling-before-start-of-work-4', label: 'Is the coordination between various services in terms of spacing and depth correct?', type: 'percentage-remarks', hasMedia: true },
          { id: 'grid-ceiling-before-start-of-work-5', label: 'Is there adequate space below the services to accommodate light fixtures in coordination with ceiling tiles?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'grid-ceiling-during-execution-1', label: 'Are ceiling tiles correctly hung in the grid?', type: 'percentage-remarks', hasMedia: true },
          { id: 'grid-ceiling-during-execution-2', label: 'Are the service tiles being installed at appropriate places as per the drawings?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'grid-ceiling-post-completion-1', label: 'Are cutouts needed for fittings / fixtures made?', type: 'percentage-remarks', hasMedia: true },
          { id: 'grid-ceiling-post-completion-2', label: 'Has it been ensured that the load of the service fixtures/fittings are not transferred to the grids?', type: 'percentage-remarks', hasMedia: true },
          { id: 'grid-ceiling-post-completion-3', label: 'Are there any damaged grid tiles? Have they been replaced?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'glazing',
    name: 'Glazing',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'glazing-before-start-of-work-1', label: 'Were all the welding works completed before the erection/fixing of the glass?', type: 'percentage-remarks', hasMedia: true },
          { id: 'glazing-before-start-of-work-2', label: 'Are all markings on the floor verified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'glazing-before-start-of-work-3', label: 'Are all the materials used of the approved make and as per the specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'glazing-before-start-of-work-4', label: 'Are all the fixing arrangements for the glass done as per specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'glazing-before-start-of-work-5', label: 'Are all the joints between glasses properly sealed?', type: 'percentage-remarks', hasMedia: true },
          { id: 'glazing-before-start-of-work-6', label: 'Is the quality of sealant used as per the specifications?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'glazing-during-execution-1', label: 'Is it ensured that the glasses are handled with care to avoid breaking of glasses and causing injuries?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'glazing-post-completion-1', label: 'Are noticeable markings done on the glass after erection to avoid people from banging on it and causing an injury?', type: 'percentage-remarks', hasMedia: true },
          { id: 'glazing-post-completion-2', label: 'Is cleaning done properly to avoid making scratches on the glass?', type: 'percentage-remarks', hasMedia: true },
          { id: 'glazing-post-completion-3', label: 'Are the corners and HPG edges protected to avoid damages?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'wall-cladding-flooring',
    name: 'Wall Cladding & Flooring',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'wall-cladding---flooring-before-start-of-work-1', label: 'Are the walls in plumb and at right angles?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-before-start-of-work-2', label: 'Was the pressure testing completed for the plumbing works before the start of cladding and tiling works in toilets?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-before-start-of-work-3', label: 'Is water proofing done on the toilet floors and the quality checked?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-before-start-of-work-4', label: 'Is the sub-base for laying tiles (walls and floor) adequately cleaned and levelled?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-before-start-of-work-5', label: 'Are all the levels and tile marking as specified in the drawings?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-before-start-of-work-6', label: 'Are the materials used of the approved make and as per the specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-before-start-of-work-7', label: 'Are all the necessary service works complete?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'wall-cladding---flooring-during-execution-1', label: 'Are the levels being maintained while laying flooring?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-during-execution-2', label: 'Are the joints between the tiles as per the specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-during-execution-3', label: 'Is the correct mortar mix being used at the back of the tiles?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'wall-cladding---flooring-post-completion-1', label: 'After completing tiling, is it being cured periodically?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-post-completion-2', label: 'Are the tiles laid in level?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-post-completion-3', label: 'Are the grooves between the tiles evenly pointed / grooved?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-post-completion-4', label: 'Do floor tiles have protective covering on them?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-post-completion-5', label: 'Is painting completed before grouting of the tile joints?', type: 'percentage-remarks', hasMedia: true },
          { id: 'wall-cladding---flooring-post-completion-6', label: 'Are all the cutouts required for services done and location of the same verified?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'lamination-veneering',
    name: 'Lamination & Veneering',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'lamination---veneering-before-start-of-work-1', label: 'Is the surface to take up the laminate dust free / cleaned properly?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-before-start-of-work-2', label: 'Is the surface on which lamination has to be done is free of moisture?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-before-start-of-work-3', label: 'Is the grade of materials and adhesives used as per the specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-before-start-of-work-4', label: 'Are all the necessary services and wiring complete as required?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-before-start-of-work-5', label: 'Is the base to take up the laminate in vertical plumb and at right angles.', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: []
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'lamination---veneering-post-completion-1', label: 'Does the laminated / veneered surface look even on a visual inspection?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-post-completion-2', label: 'Is the excess adhesive removed immediately (within 8-10 hours)?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-post-completion-3', label: 'Are the edges and corners of all finished surfaces adequately protected?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-post-completion-4', label: 'Are the nails used to keep the laminate in place before setting of adhesive, removed immediately after the setting time?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-post-completion-5', label: 'Are the edges planed immediately after setting to avoid damage?', type: 'percentage-remarks', hasMedia: true },
          { id: 'lamination---veneering-post-completion-6', label: 'Have the adhesive marks cleaned off the laminate/veneer surface without damaging the surface?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'painting',
    name: 'Painting',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'painting-before-start-of-work-1', label: 'Is the sub-base for painting prepared as specified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-before-start-of-work-2', label: 'Are all conduiting and metal box fixing for services complete?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-before-start-of-work-3', label: 'Have all service fixtures/fittings been fixed and protected with tape/polythene before first coat of paint?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-before-start-of-work-4', label: 'Is the grade of all materials used as per specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-before-start-of-work-5', label: 'Have necessary shade approvals been taken from the Architect / Client on the color scheme?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-before-start-of-work-6', label: 'Is the structural glazing/window glazing complete before commencement of painting?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-before-start-of-work-7', label: 'Is the A/C commissioned before the final coat of paint?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'painting-during-execution-1', label: 'Are subsequent coats taken up after the base coat is dried adequately as per the requirement?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-during-execution-2', label: 'Is the consistency of the paint maintained? (Is the paint and thinner mixed uniformly as per the specified proportions?)', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-during-execution-3', label: 'While applying different shades, is the line formation verified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-during-execution-4', label: 'Are the accessories used for painting as per specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-during-execution-5', label: 'Are all glasses and laminates in the surface to be painted adequately covered?', type: 'percentage-remarks', hasMedia: true },
          { id: 'painting-during-execution-6', label: 'Is the application of final coat taken up after AHU is commissioned?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'painting-post-completion-1', label: 'Were all the fixture/fittings properly masked and paint marks on fixtures/fittings/hardware etc cleaned?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'carpets-vinyl-flooring',
    name: 'Carpets & Vinyl Flooring',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'carpets---vinyl-flooring-before-start-of-work-1', label: 'Is the sub-base prepared and leveled uniformly adequately to take the carpet/vinyl floor?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-before-start-of-work-2', label: 'Are all welding works completed before carpeting/vinyl flooring?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-before-start-of-work-3', label: 'Is the floor thoroughly cleaned before laying the carpet/vinyl floor?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-before-start-of-work-4', label: 'Is the area where carpet or vinyl floor is to be laid barricaded to restrict movement?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-before-start-of-work-5', label: 'Is the grade of materials and adhesives used as per specifications?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-before-start-of-work-6', label: 'Is the floor free from any dampness?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-before-start-of-work-7', label: 'Are all the works which produce dust completed before carpeting/vinyl flooring starts?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-before-start-of-work-8', label: 'Are all synthetic spray paint works complete before carpeting/vinyl flooring starts?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'carpets---vinyl-flooring-during-execution-1', label: 'Is it ensured that no welding works are happening in the vicinity?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'carpets---vinyl-flooring-post-completion-1', label: 'Is the carpet or vinyl floor covered with a protective layer?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-post-completion-2', label: 'In the areas carpeted or where vinyl floor is laid, is there restricted usage of scaffolding materials?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-post-completion-3', label: 'Has it been ensured that in these areas there is restricted storage of high load materials?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-post-completion-4', label: 'After laying, were the levels cross checked?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-post-completion-5', label: 'Are all loose threads and edges trimmed off after laying?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-post-completion-6', label: 'Are transition and interface trims fixed to avoid damages?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-post-completion-7', label: 'Is the protective layer cleaned regularly?', type: 'percentage-remarks', hasMedia: true },
          { id: 'carpets---vinyl-flooring-post-completion-8', label: 'Are all activities that cause damage to flooring avoided in these areas?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  },
  {
    id: 'ws-loose-furniture',
    name: 'WS & Loose Furniture',
    subsections: [
      {
        name: 'Before Start of Work',
        items: [
          { id: 'ws---loose-furniture-before-start-of-work-1', label: 'Are all service works, wiring required for the workstations and loose furniture complete?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-before-start-of-work-2', label: 'Is the quality of the materials for modular installations and loose furniture delivered at site checked?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-before-start-of-work-3', label: 'Are the areas which accommodate workstations and loose furniture barricaded to restrict movement?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-before-start-of-work-4', label: 'If there are glasses along the aisle side of the workstation area, then are they cleaned before erection of workstations?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-before-start-of-work-5', label: 'Are all the walls along the aisle side of the workstation areas painted before erection of workstations?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-before-start-of-work-6', label: 'Is the location of cutouts required for data and power provided and the same verified?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-before-start-of-work-7', label: 'In case the furniture has power beams are the sizes coordinated with electrical and data sockets?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'During Execution',
        items: [
          { id: 'ws---loose-furniture-during-execution-1', label: 'Is the location as per the layout?', type: 'percentage-remarks', hasMedia: true }
        ]
      },
      {
        name: 'Post Completion',
        items: [
          { id: 'ws---loose-furniture-post-completion-1', label: 'Are all the levels and alignment of the workstations and loose furniture laid proper?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-post-completion-2', label: 'Has protective coating been done on the fabric panels?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-post-completion-3', label: 'Are all the fixtures and accessories in good working condition?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-post-completion-4', label: 'Are all the replacements required for damaged materials desnagged?', type: 'percentage-remarks', hasMedia: true },
          { id: 'ws---loose-furniture-post-completion-5', label: 'Are all trims, powder coated members at the corners and high traffic areas, etc, which are susceptible to damage adequately protected?', type: 'percentage-remarks', hasMedia: true }
        ]
      }
    ]
  }
];
