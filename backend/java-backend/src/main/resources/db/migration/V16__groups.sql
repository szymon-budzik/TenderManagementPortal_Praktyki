CREATE TABLE app_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    parent_id BIGINT REFERENCES app_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_groups_parent_id ON app_groups(parent_id);

CREATE TABLE app_group_members (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES app_groups(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_app_group_members_group_user UNIQUE (group_id, user_id)
);

CREATE INDEX idx_app_group_members_group_id ON app_group_members(group_id);
CREATE INDEX idx_app_group_members_user_id ON app_group_members(user_id);
