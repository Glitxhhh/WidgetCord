// Discord's "dynamic" field type codes and the field-name/type map for the
// widget_bottom_progress + mini_profile_hero_stat + widget_top_hero + activity_accessory_stat
// layout combo, reverse-engineered live against a published widget-config. Shared by
// updater.js (which pushes updates) and setup.js (which creates the initial widget-config).

const TEXT = 1;
const NUMBER = 2;
const IMAGE = 3;

// Field name -> type, in a stable order. progress_current / progress_max are computed
// per-run by updater.js, not read from staticFields.
const FIELD_ORDER = [
  ['name', TEXT],
  ['sub01', TEXT],
  ['primary_image', IMAGE],
  ['preview_icon', IMAGE],
  ['preview_image', IMAGE],
  ['preview_value', TEXT],
  ['mini_text', TEXT],
  ['mini_icon', IMAGE],
  ['sub01_icon', IMAGE],
  ['mini_image', IMAGE],
  ['progress_text', TEXT],
  ['progress_description', TEXT],
  ['progress_current', NUMBER], // computed
  ['progress_max', NUMBER],     // computed
  ['progress_image', IMAGE],
  ['activity_text', TEXT],
];

// The widget-config "surfaces" schema for this layout combo. Every field's `value` is the
// key name that the identities/{id}/profile PATCH later supplies real data for -- this is
// pure layout/schema, no live values live here.
function buildSurfacesSchema() {
  return {
    widget_bottom: {
      layout: 'widget_bottom_progress',
      components: {
        progress: {
          fields: {
            current: { value_type: 'data', presentation_type: 'number', value: 'progress_current' },
            max: { value_type: 'data', presentation_type: 'number', value: 'progress_max' },
          },
        },
        objective: {
          fields: {
            description: { value_type: 'data', presentation_type: 'text', value: 'progress_description' },
            image: { value_type: 'data', presentation_type: 'image', value: 'progress_image' },
            name: { value_type: 'data', presentation_type: 'text', value: 'progress_text' },
          },
        },
      },
    },
    mini_profile: {
      layout: 'mini_profile_hero_stat',
      components: {
        stat: {
          fields: {
            text: { value_type: 'data', presentation_type: 'text', value: 'mini_text' },
            icon: { value_type: 'data', presentation_type: 'image', value: 'mini_icon' },
          },
        },
        hero_image: {
          fields: {
            image: { value_type: 'data', presentation_type: 'image', value: 'primary_image' },
          },
        },
      },
    },
    widget_top: {
      layout: 'widget_top_hero',
      components: {
        title: { fields: { text: { value_type: 'data', presentation_type: 'text', value: 'name' } } },
        subtitle_1: { fields: { text: { value_type: 'data', presentation_type: 'text', value: 'sub01' } } },
        hero_image: {
          fields: {
            image: { value_type: 'data', presentation_type: 'image', value: 'primary_image' },
          },
        },
      },
    },
    add_widget_preview: {
      layout: 'add_widget_preview_hero',
      components: {
        hero_image: {
          fields: {
            image: { value_type: 'data', presentation_type: 'image', value: 'primary_image' },
          },
        },
      },
    },
    activity_accessory: {
      layout: 'activity_accessory_stat',
      components: {
        stat: {
          fields: {
            text: { value_type: 'data', presentation_type: 'text', value: 'activity_text' },
            icon: { value_type: 'data', presentation_type: 'image', value: 'activity_icon' },
          },
        },
      },
    },
  };
}

module.exports = { TEXT, NUMBER, IMAGE, FIELD_ORDER, buildSurfacesSchema };
